import { ExecutionContext, Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ConfigService } from "src/config/config.service";

@Injectable()
export class JwtGuard extends AuthGuard("jwt") {
  constructor(private config: ConfigService) {
    super();
  }
  /**
   * If the user is not authenticated and allowUnauthenticatedShares is true, return true
   * Otherwise, return false
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      return (await super.canActivate(context)) as boolean;
    } catch {
      return this.config.get("share.allowUnauthenticatedShares");
    }
  }
}
