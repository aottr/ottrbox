import { LoadingOverlay } from "@mantine/core";
import { useModals } from "@mantine/modals";
import { GetServerSidePropsContext } from "next";
import { useEffect } from "react";
import Meta from "../../../components/Meta";
import showErrorModal from "../../../components/share/showErrorModal";
import EditableUpload from "../../../components/upload/EditableUpload";
import useConfirmLeave from "../../../hooks/confirm-leave.hook";
import useTranslate from "../../../hooks/useTranslate.hook";
import shareService from "../../../services/share.service";
import { Share as ShareType } from "../../../types/share.type";
import { useQuery } from "@tanstack/react-query";
import { AxiosError } from "axios";

export function getServerSideProps(context: GetServerSidePropsContext) {
  return {
    props: { shareId: context.params!.shareId },
  };
}

const Share = ({ shareId }: { shareId: string }) => {
  const t = useTranslate();
  const modals = useModals();

  const { data: share, error, isLoading } = useQuery<ShareType>({
    queryKey: ["share", shareId],
    retry: false,
    queryFn: () => shareService.getFromOwner(shareId)
  });

  useConfirmLeave({
    message: t("upload.notify.confirm-leave"),
    enabled: isLoading,
  });

  useEffect(() => {
    if (!(error instanceof AxiosError) || !error.response) {
      return;
    }

    const { data: errorData, status: errorStatus } = error.response;
    if (errorStatus == 404) {
      if (errorData.error == "share_removed") {
        showErrorModal(
          modals,
          t("share.error.removed.title"),
          errorData.message,
        );
      } else {
        showErrorModal(
          modals,
          t("share.error.not-found.title"),
          t("share.error.not-found.description"),
        );
      }
    } else if (errorStatus == 403) {
      showErrorModal(
        modals,
        t("share.error.access-denied.title"),
        t("share.error.access-denied.description"),
      );
    } else {
      showErrorModal(modals, t("common.error"), t("common.error.unknown"));
    }
  }, [error]);

  if (isLoading) return <LoadingOverlay visible />;

  return (
    <>
      <Meta title={t("share.edit.title", { shareId })} />
      <EditableUpload shareId={shareId} files={share?.files || []} />
    </>
  );
};

export default Share;
