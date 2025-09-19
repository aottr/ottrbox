import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { JwtService, JwtSignOptions } from "@nestjs/jwt";
import { Prisma, Share, User } from "@prisma/client";
import * as archiver from "archiver";
import * as argon from "argon2";
import * as fs from "fs";
import * as moment from "moment";
import { ClamScanService } from "src/clamscan/clamscan.service";
import { ConfigService } from "src/config/config.service";
import { EmailService } from "src/email/email.service";
import { FileService } from "src/file/file.service";
import { PrismaService } from "src/prisma/prisma.service";
import { ReverseShareService } from "src/reverseShare/reverseShare.service";
import { parseRelativeDateToAbsolute } from "src/utils/date.util";
import { SHARE_DIRECTORY } from "../constants";
import { CreateShareDTO } from "./dto/createShare.dto";

@Injectable()
export class ShareService {

  private readonly logger = new Logger(ShareService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private fileService: FileService,
    private emailService: EmailService,
    private config: ConfigService,
    private jwtService: JwtService,
    private reverseShareService: ReverseShareService,
    private clamScanService: ClamScanService,
  ) { }

  async create(share: CreateShareDTO, user?: User, reverseShareToken?: string) {
    if (!(await this.isShareIdAvailable(share.id)).isAvailable)
      throw new BadRequestException("Share id already in use");

    this.logger.debug(
      `Creating share: shareId=${share.id} userId=${user?.id ?? "anonymous"} reverseShareToken=${reverseShareToken ? "provided" : "none"}`
    );

    const hasSecurity = !!share.security && Object.keys(share.security).length > 0;
    const hasPassword = !!share.security?.password;
    
    if (!hasSecurity) {
      this.logger.debug(`No security provided: shareId=${share.id}`);
      share.security = undefined;
    } else {
      this.logger.debug(
        `Security provided: shareId=${share.id} passwordProtected=${hasPassword} maxViews=${share.security?.maxViews ?? "none"}`
      );
    }
    if (hasPassword) {
      this.logger.debug(`Hashing password: shareId=${share.id}`);
      share.security.password = await argon.hash(share.security.password);
    }

    let expirationDate: Date;

    // If share is created by a reverse share token override the expiration date
    const reverseShare =
      await this.reverseShareService.getByToken(reverseShareToken);
    if (reverseShare) {
      expirationDate = reverseShare.shareExpiration;
      this.logger.debug(
        `Using reverse share expiration: shareId=${share.id} reverseShareToken=provided expiration=${expirationDate.toISOString()}`
      );
    } else {
      const parsedExpiration = parseRelativeDateToAbsolute(share.expiration);
      const expiresNever = moment(0).toDate() == parsedExpiration;
      const maxExpiration = this.config.get("share.maxExpiration");
      const maxExpiryDate = moment().add(maxExpiration.value, maxExpiration.unit).toDate();

      if (
        maxExpiration.value !== 0 &&
        (expiresNever ||
          parsedExpiration >
          maxExpiryDate)
      ) {
        this.logger.warn(
          `Expiration exceeds maximum: shareId=${share.id} requested=${parsedExpiration.toISOString()} max=${maxExpiryDate.toISOString()}`
        );
        throw new BadRequestException(
          "Expiration date exceeds maximum expiration date",
        );
      }

      expirationDate = parsedExpiration;
      this.logger.debug(
        `Computed expiration: shareId=${share.id} expiration=${expirationDate.toISOString()}`
      );
    }

    fs.mkdirSync(`${SHARE_DIRECTORY}/${share.id}`, {
      recursive: true,
    });
    this.logger.debug(`Ensured share directory: shareId=${share.id} path=${SHARE_DIRECTORY}/${share.id}`);

    const storageProvider = this.configService.get("s3.enabled") ? "S3" : "LOCAL";
    this.logger.debug(`Selected storage provider: shareId=${share.id} provider=${storageProvider}`);


    const shareTuple = await this.prisma.share.create({
      data: {
        ...share,
        expiration: expirationDate,
        creator: { connect: user ? { id: user.id } : undefined },
        security: { create: share.security },
        recipients: {
          create: share.recipients
            ? share.recipients.map((email) => ({ email }))
            : [],
        },
        storageProvider: this.configService.get("s3.enabled") ? "S3" : "LOCAL",
      },
    });

    this.logger.debug(
      `Share created: shareId=${share.id} userId=${user?.id ?? "anonymous"} recipients=${share.recipients?.length ?? 0} storage=${storageProvider} expires=${expirationDate.toISOString()}`
    );

    if (reverseShare) {
      // Assign share to reverse share token
      await this.prisma.reverseShare.update({
        where: { token: reverseShareToken },
        data: {
          shares: {
            connect: { id: shareTuple.id },
          },
        },
      });
      this.logger.debug(`Linked share to reverse share: shareId=${share.id}`);
    }

    return shareTuple;
  }

  async createZip(shareId: string) {
    if (this.config.get("s3.enabled")) return;

    const path = `${SHARE_DIRECTORY}/${shareId}`;

    const files = await this.prisma.file.findMany({ where: { shareId } });
    const archive = archiver("zip", {
      zlib: { level: this.config.get("share.zipCompressionLevel") },
    });
    const writeStream = fs.createWriteStream(`${path}/archive.zip`);

    for (const file of files) {
      archive.append(fs.createReadStream(`${path}/${file.id}`), {
        name: file.name,
      });
    }

    archive.pipe(writeStream);
    await archive.finalize();
    this.logger.debug(`Created zip: shareId=${shareId}`);
  }

  async complete(id: string, reverseShareToken?: string) {

    this.logger.debug(`Completing share: shareId=${id} reverseShareToken=${reverseShareToken ? "provided" : "none"}`);

    const share = await this.prisma.share.findUnique({
      where: { id },
      include: {
        files: true,
        recipients: true,
        creator: true,
        reverseShare: { include: { creator: true } },
      },
    });

    if (!share) {
      this.logger.warn(`Share not found on complete: shareId=${id}`);
      throw new NotFoundException("Share not found");
    }

    if (await this.isShareCompleted(id)) {
      this.logger.warn(`Share already completed: shareId=${id}`);
      throw new BadRequestException("Share already completed");
    }

    if (share.files.length === 0) {
      this.logger.warn(`Attempt to complete without files: shareId=${id}`);
      throw new BadRequestException("You need at least on file in your share to complete it.");
    }

    // Asynchronously create a zip of all files
    if (share.files.length > 1) {
      this.logger.debug(`Scheduling zip creation: shareId=${id} fileCount=${share.files.length}`);
      this.createZip(id)
        .then(async () => {
          await this.prisma.share.update({ where: { id }, data: { isZipReady: true } });
          this.logger.debug(`Zip ready: shareId=${id}`);
        })
        .catch((err) => {
          this.logger.error(`Zip creation failed: shareId=${id} error=${(err as Error).message}`);
        });
    }

    // Send email for each recipient
    const recipientCount = share.recipients.length;
    if (recipientCount > 0 && this.config.get("smtp.enabled")) {
      this.logger.debug(`Sending recipient emails: shareId=${id} recipients=${recipientCount}`);
      for (const recipient of share.recipients) {
        try {
          await this.emailService.sendMailToShareRecipients(
            recipient.email,
            share.id,
            share.creator,
            share.description,
            share.expiration,
          );
          this.logger.debug(`Recipient email sent: shareId=${id} recipient=${recipient.email}`);
        } catch (err) {
          // Log and continue sending to others
          this.logger.error(`Recipient email failed: shareId=${id} recipient=${recipient.email} error=${(err as Error).message}`);
        }
      }
    } else {
      this.logger.debug(`Skipping recipient emails: shareId=${id} recipients=${recipientCount} smtpEnabled=${this.config.get("smtp.enabled")}`);
    }

    // Optionally notify reverse share creator
    const notifyReverseShareCreator =
      share.reverseShare ? this.config.get("smtp.enabled") && share.reverseShare.sendEmailNotification : undefined;

    if (notifyReverseShareCreator) {
      try {
        await this.emailService.sendMailToReverseShareCreator(
          share.reverseShare.creator.email,
          share.id,
        );
        this.logger.debug(`Reverse share creator notified: shareId=${id}`);
      } catch (err) {
        this.logger.error(`Reverse share notification failed: shareId=${id} error=${(err as Error).message}`);
      }
    }

    // Check if any file is malicious with ClamAV
    this.logger.debug(`Scheduling malware scan: shareId=${id}`);
    void this.clamScanService.checkAndRemove(share.id);

    // Decrement reverse share remaining uses if applicable
    if (share.reverseShare) {
      try {
        await this.prisma.reverseShare.update({
          where: { token: reverseShareToken },
          data: { remainingUses: { decrement: 1 } },
        });
        this.logger.debug(`Reverse share remainingUses decremented: shareId=${id}`);
      } catch (err) {
        this.logger.error(`Failed to decrement reverse share uses: shareId=${id} error=${(err as Error).message}`);
      }
    }

    // Lock uploads
    const updatedShare = await this.prisma.share.update({
      where: { id },
      data: { uploadLocked: true },
    });
    this.logger.debug(`Share completed: shareId=${id} files=${share.files.length} recipients=${recipientCount} uploadLocked=true`);

    return {
      ...updatedShare,
      notifyReverseShareCreator,
    };
  }

  async revertComplete(id: string) {

    this.logger.debug(`Revert completion of share: shareId=${id}`);
    return this.prisma.share.update({
      where: { id },
      data: { uploadLocked: false, isZipReady: false },
    });
  }

  async getShares() {
    const shares = await this.prisma.share.findMany({
      orderBy: {
        expiration: "desc",
      },
      include: { files: true, creator: true },
    });

    return shares.map((share) => {
      return {
        ...share,
        size: share.files.reduce((acc, file) => acc + parseInt(file.size), 0),
      };
    });
  }

  async getStoredRecipientsByUser(userId: string, query?: string) {
    const recipients = await this.prisma.shareRecipient.findMany({
      where: {
        share: {
          creatorId: userId
        },
        email: {
          contains: query,
        }
      },
      orderBy: {
        email: "asc"
      },
      select: {
        email: true
      },
      distinct: Prisma.ShareRecipientScalarFieldEnum.email
    });

    return recipients.map(recipient => recipient.email);
  }

  async getSharesByUser(userId: string) {
    const shares = await this.prisma.share.findMany({
      where: {
        creator: { id: userId },
        uploadLocked: true,
        // We want to grab any shares that are not expired or have their expiration date set to "never" (unix 0)
        OR: [
          { expiration: { gt: new Date() } },
          { expiration: { equals: moment(0).toDate() } },
        ],
      },
      orderBy: {
        expiration: "desc",
      },
      include: { recipients: true, files: true, security: true },
    });

    return shares.map((share) => {
      return {
        ...share,
        size: share.files.reduce((acc, file) => acc + parseInt(file.size), 0),
        recipients: share.recipients.map((recipients) => recipients.email),
        security: {
          maxViews: share.security?.maxViews,
          passwordProtected: !!share.security?.password,
        },
      };
    });
  }

  async get(id: string): Promise<any> {
    const share = await this.prisma.share.findUnique({
      where: { id },
      include: {
        files: {
          orderBy: {
            name: "asc",
          },
        },
        creator: true,
        security: true,
      },
    });

    if (share.removedReason)
      throw new NotFoundException(share.removedReason, "share_removed");

    if (!share || !share.uploadLocked)
      throw new NotFoundException("Share not found");
    return {
      ...share,
      hasPassword: !!share.security?.password,
    };
  }

  async getMetaData(id: string) {
    const share = await this.prisma.share.findUnique({
      where: { id },
    });

    if (!share || !share.uploadLocked)
      throw new NotFoundException("Share not found");

    return share;
  }

  async remove(shareId: string, isDeleterAdmin = false) {
    this.logger.debug(`Removing share: shareId=${shareId} isDeleterAdmin=${isDeleterAdmin}`);
    const share = await this.prisma.share.findUnique({
      where: { id: shareId },
    });

    if (!share) {
      this.logger.warn(`Share not found on remove: shareId=${shareId}`);
      throw new NotFoundException("Share not found");
    }

    // Anonymous shares can only be deleted by admins
    if (!share.creatorId && !isDeleterAdmin) {
      this.logger.warn(`Forbidden remove for anonymous share: shareId=${shareId}`);
      throw new ForbiddenException("Anonymous shares can't be deleted");
    }

    // Delete files first; if it fails, abort DB deletion
    try {
      await this.fileService.deleteAllFiles(shareId);
      this.logger.debug(`All files deleted: shareId=${shareId}`);
    } catch (err) {
      this.logger.error(`File deletion failed: shareId=${shareId} error=${(err as Error).message}`);
      throw new InternalServerErrorException("Failed to delete all files of the share. Share has not been removed.");
    }

    // Only if files deletion succeeded, remove DB record
    await this.prisma.share.delete({ where: { id: shareId } });
    this.logger.debug(
      `Share removed: shareId=${shareId} deletedBy=${share.creatorId ? "owner_or_user" : (isDeleterAdmin ? "admin" : "unknown")}`
    );
  }

  async isShareCompleted(id: string) {
    return (await this.prisma.share.findUnique({ where: { id } })).uploadLocked;
  }

  async isShareIdAvailable(id: string) {
    const share = await this.prisma.share.findUnique({ where: { id } });
    return { isAvailable: !share };
  }

  async increaseViewCount(share: Share) {
    await this.prisma.share.update({
      where: { id: share.id },
      data: { views: share.views + 1 },
    });
  }

  async getShareToken(shareId: string, password: string) {
    const share = await this.prisma.share.findFirst({
      where: { id: shareId },
      include: {
        security: true,
      },
    });

    if (share?.security?.password) {
      if (!password) {
        throw new ForbiddenException(
          "This share is password protected",
          "share_password_required",
        );
      }

      const isPasswordValid = await argon.verify(
        share.security.password,
        password,
      );
      if (!isPasswordValid) {
        throw new ForbiddenException("Wrong password", "wrong_password");
      }
    }

    if (share.security?.maxViews && share.security.maxViews <= share.views) {
      throw new ForbiddenException(
        "Maximum views exceeded",
        "share_max_views_exceeded",
      );
    }

    const token = await this.generateShareToken(shareId);
    await this.increaseViewCount(share);
    return token;
  }

  async generateShareToken(shareId: string) {
    const { expiration, createdAt } = await this.prisma.share.findUnique({
      where: { id: shareId },
    });

    const tokenPayload = {
      shareId,
      shareCreatedAt: moment(createdAt).unix(),
      iat: moment().unix(),
    };

    const tokenOptions: JwtSignOptions = {
      secret: this.config.get("internal.jwtSecret"),
    };

    if (!moment(expiration).isSame(0)) {
      tokenOptions.expiresIn = moment(expiration).diff(new Date(), "seconds");
    }

    return this.jwtService.sign(tokenPayload, tokenOptions);
  }

  async verifyShareToken(shareId: string, token: string) {
    const { expiration, createdAt } = await this.prisma.share.findUnique({
      where: { id: shareId },
    });

    try {
      const claims = this.jwtService.verify(token, {
        secret: this.config.get("internal.jwtSecret"),
        // Ignore expiration if expiration is 0
        ignoreExpiration: moment(expiration).isSame(0),
      });

      return (
        claims.shareId == shareId &&
        claims.shareCreatedAt == moment(createdAt).unix()
      );
    } catch {
      return false;
    }
  }
}
