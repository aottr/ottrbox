import {
  ActionIcon,
  Box,
  Group,
  Skeleton,
  Stack,
  Table,
  TextInput,
} from "@mantine/core";
import { useClipboard } from "@mantine/hooks";
import { useModals } from "@mantine/modals";
import { useMemo, useState } from "react";
import { TbDownload, TbEye, TbLink } from "react-icons/tb";
import { FormattedMessage } from "react-intl";
import useTranslate from "../../hooks/useTranslate.hook";
import shareService from "../../services/share.service";
import { FileMetaData } from "../../types/File.type";
import { Share } from "../../types/share.type";
import { byteToHumanSizeString } from "../../utils/fileSize.util";
import toast from "../../utils/toast.util";
import TableSortIcon, { TableSort } from "../core/SortIcon";
import showFilePreviewModal from "./modals/showFilePreviewModal";
import useConfig from "../../hooks/config.hook";

const FileList = ({
  files,
  share,
  isLoading,
}: {
  files: FileMetaData[];
  share?: Share;
  isLoading: boolean;
}) => {
  const clipboard = useClipboard();
  const modals = useModals();
  const t = useTranslate();
  const config = useConfig();

  const [sort, setSort] = useState<TableSort>({
    property: "name",
    direction: "desc",
  });

  const sortedFiles = useMemo(() => {
    if (files && sort.property) {
      return [...files].sort((a, b) => {
        const property = sort.property as keyof FileMetaData;
        if (sort.direction === "asc") {
          return a[property].localeCompare(b[property], undefined, {
            numeric: true,
          });
        }
        return b[property].localeCompare(a[property], undefined, {
          numeric: true,
        });
      });
    }
    return files;
  }, [files, sort]);

  const copyFileLink = (file: FileMetaData) => {

    const link = `${config.get("general.appUrl")}/api/shares/${share!.id
      }/files/${file.id}`;

    if (window.isSecureContext) {
      clipboard.copy(link);
      toast.success(t("common.notify.copied-link"));
    } else {
      modals.openModal({
        title: t("share.modal.file-link"),
        children: (
          <Stack align="stretch">
            <TextInput variant="filled" value={link} />
          </Stack>
        ),
      });
    }
  };

  return (
    <Box sx={{ display: "block", overflowX: "auto" }}>
      <Table>
        <thead>
          <tr>
            <th>
              <Group spacing="xs">
                <FormattedMessage id="share.table.name" />
                <TableSortIcon sort={sort} setSort={setSort} property="name" />
              </Group>
            </th>
            <th>
              <Group spacing="xs">
                <FormattedMessage id="share.table.size" />
                <TableSortIcon sort={sort} setSort={setSort} property="size" />
              </Group>
            </th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {isLoading || !share
            ? skeletonRows
            : sortedFiles.map((file, index) => (
              <tr key={index}>
                <td>{file.name}</td>
                <td>{file.size ? byteToHumanSizeString(parseInt(file.size)) : "-"}</td>
                <td>
                  <Group position="right">
                    {shareService.doesFileSupportPreview(file.name) && (
                      <ActionIcon
                        onClick={() =>
                          showFilePreviewModal(share.id, file, modals)
                        }
                        size={25}
                      >
                        <TbEye />
                      </ActionIcon>
                    )}
                    {!share.hasPassword && (
                      <ActionIcon
                        size={25}
                        onClick={() => copyFileLink(file)}
                      >
                        <TbLink />
                      </ActionIcon>
                    )}
                    <ActionIcon
                      size={25}
                      onClick={async () => {
                        await shareService.downloadFile(share.id, file.id);
                      }}
                    >
                      <TbDownload />
                    </ActionIcon>
                  </Group>
                </td>
              </tr>
            ))}
        </tbody>
      </Table>
    </Box>
  );
};

const skeletonRows = [...Array(5)].map((c, i) => (
  <tr key={i}>
    <td>
      <Skeleton height={30} width={30} />
    </td>
    <td>
      <Skeleton height={14} />
    </td>
    <td>
      <Skeleton height={25} width={25} />
    </td>
  </tr>
));

export default FileList;
