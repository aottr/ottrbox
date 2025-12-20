import { LoadingOverlay } from "@mantine/core";
import { useModals } from "@mantine/modals";
import { GetServerSidePropsContext } from "next";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Upload from ".";
import showErrorModal from "../../components/share/showErrorModal";
import shareService from "../../services/share.service";
import useTranslate from "../../hooks/useTranslate.hook";
import { ReverseShare } from "../../types/share.type";
import { AxiosError } from "axios";

export function getServerSideProps(context: GetServerSidePropsContext) {
  return {
    props: { reverseShareToken: context.params!.reverseShareToken },
  };
}

const Share = ({ reverseShareToken }: { reverseShareToken: string }) => {
  const modals = useModals();
  const t = useTranslate();

  const { data: reverseShare, isLoading, error } = useQuery<ReverseShare>({
    queryKey: ["reverseShare", reverseShareToken],
    queryFn: () => shareService.getReverseShare(reverseShareToken),
    retry: false,
  });

  useEffect(() => {
    if (!(error instanceof AxiosError) || !error.response) {
      return;
    }

    if (error.response.status == 404) {
      showErrorModal(
        modals,
        t("upload.reverse-share.error.invalid.title"),
        t("upload.reverse-share.error.invalid.description"),
        "go-home",
      );
    } else {
      showErrorModal(modals, t("common.error"), t("common.error.unknown"));
    }
  }, [error]);

  if (isLoading) return <LoadingOverlay visible />;

  return (
    <Upload
      isReverseShare
      name={reverseShare?.name}
      maxShareSize={parseInt(reverseShare?.maxShareSize || "0")}
      simplified={reverseShare?.simplified || false}
    />
  );
};

export default Share;
