import { Box, Menu } from "@mantine/core";
import Link from "next/link";
import { TbArrowLoopLeft, TbLink, TbUser } from "react-icons/tb";
import { FormattedMessage } from "react-intl";
import { useStyles } from "./Header.styles";

const NavbarShareMneu = () => {

  const { classes, cx } = useStyles();

  return (
    <Menu position="bottom-start" withinPortal>
      <Menu.Target>
        <Box className={cx(classes.link, classes.withIcon)}>
          <TbLink size={14} />
          <FormattedMessage id="navbar.shares" />
        </Box>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item component={Link} href="/account/shares" icon={<TbLink />}>
          <FormattedMessage id="navbar.links.shares" />
        </Menu.Item>
        <Menu.Item
          component={Link}
          href="/account/reverseShares"
          icon={<TbArrowLoopLeft />}
        >
          <FormattedMessage id="navbar.links.reverse" />
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
};

export default NavbarShareMneu;
