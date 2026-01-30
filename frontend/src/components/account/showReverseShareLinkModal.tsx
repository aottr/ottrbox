import { Stack, TextInput } from "@mantine/core";
import { ModalsContextProps } from "@mantine/modals/lib/context";
import { translateOutsideContext } from "../../hooks/useTranslate.hook";
import useConfig from "../../hooks/config.hook";

const showReverseShareLinkModal = (
  modals: ModalsContextProps,
  reverseShareToken: string,
) => {
  const t = translateOutsideContext();
  return modals.openModal({
    title: t("account.reverseShares.modal.reverse-share-link"),
    children: <ReverseShareLinkContent reverseShareToken={reverseShareToken} />,
  });
};

const ReverseShareLinkContent = ({
  reverseShareToken,
}: {
  reverseShareToken: string;
}) => {
  const config = useConfig();
  const link = `${config.get("general.appUrl")}/upload/${reverseShareToken}`;
  return (
    <Stack align="stretch">
      <TextInput variant="filled" value={link} />
    </Stack>
  );
};

export default showReverseShareLinkModal;
