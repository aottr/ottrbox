import { ActionIcon, Avatar, Box, Button, MediaQuery, Menu } from "@mantine/core";
import Link from "next/link";
import { TbDoorExit, TbSettings, TbUser } from "react-icons/tb";
import useUser from "../../hooks/user.hook";
import authService from "../../services/auth.service";
import { FormattedMessage, useIntl } from "react-intl";
import { useStyles } from "./Header.styles";

const ActionAvatar = () => {
  const { user } = useUser();
  const { classes, cx } = useStyles();

  return (
    <Menu position="bottom-start" withinPortal>
      <Menu.Target>
        <Box className={cx(classes.link, classes.withIcon)}>
          <TbUser size={14} />
          {user?.username}
        </Box>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item component={Link} href="/account" icon={<TbUser size={14} />}>
          <FormattedMessage id="navbar.avatar.account" />
        </Menu.Item>
        {user!.isAdmin && (
          <Menu.Item
            component={Link}
            href="/admin"
            icon={<TbSettings size={14} />}
          >
            <FormattedMessage id="navbar.avatar.admin" />
          </Menu.Item>
        )}

        <Menu.Item
          onClick={async () => {
            await authService.signOut();
          }}
          icon={<TbDoorExit size={14} />}
        >
          <FormattedMessage id="navbar.avatar.signout" />
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
};

export default ActionAvatar;
