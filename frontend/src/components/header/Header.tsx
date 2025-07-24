import {
  Box,
  Burger,
  Container,
  createStyles,
  Group,
  Header as MantineHeader,
  MediaQuery,
  Paper,
  Stack,
  Text,
  Transition,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import Link from "next/link";
import { useRouter } from "next/router";
import { Fragment, ReactNode, useEffect, useState } from "react";
import useConfig from "../../hooks/config.hook";
import useUser from "../../hooks/user.hook";
import useTranslate from "../../hooks/useTranslate.hook";
import Logo from "../Logo";
import ActionAvatar from "./ActionAvatar";
import NavbarShareMenu from "./NavbarShareMenu";
import { useStyles, HEADER_HEIGHT } from "./Header.styles";
import { TbUpload } from "react-icons/tb";

type NavLink = {
  link?: string;
  label?: string;
  icon?: ReactNode;
  component?: ReactNode;
  action?: () => Promise<void>;
};

const Header = () => {
  const { user } = useUser();
  const router = useRouter();
  const config = useConfig();
  const t = useTranslate();

  const [opened, toggleOpened] = useDisclosure(false);

  const [currentRoute, setCurrentRoute] = useState("");

  useEffect(() => {
    setCurrentRoute(router.pathname);
  }, [router.pathname]);

  const authenticatedLinks: NavLink[] = [
    {
      link: "/upload",
      icon: <TbUpload size={14} />,
      label: t("navbar.upload"),
    },
    {
      component: <NavbarShareMenu />,
    },
    {
      component: <ActionAvatar />,
    },
  ];

  let unauthenticatedLinks: NavLink[] = [
    {
      link: "/auth/signIn",
      label: t("navbar.signin"),
    },
  ];

  if (config.get("share.allowUnauthenticatedShares")) {
    unauthenticatedLinks.unshift({
      link: "/upload",
      icon: <TbUpload size={14} />,
      label: t("navbar.upload"),
    });
  }

  if (config.get("general.showHomePage"))
    unauthenticatedLinks.unshift({
      link: "/",
      label: t("navbar.home"),
    });

  if (config.get("share.allowRegistration"))
    unauthenticatedLinks.push({
      link: "/auth/signUp",
      label: t("navbar.signup"),
    });

  const { classes, cx } = useStyles();
  const items = (
    <>
      {(user ? authenticatedLinks : unauthenticatedLinks).map((link, i) => {
        if (link.component) {
          return <Fragment key={i}>{link.component}</Fragment>;
        }
        return (
          <Link
            key={i}
            href={link.link ?? ""}
            onClick={() => toggleOpened.toggle()}
            className={cx(classes.link, {
              [classes.linkActive]: currentRoute == link.link,
              [classes.withIcon]: !!link.icon,
            })}
          >
            {link.icon}
            {link.label}
          </Link>
        );
      })}
    </>
  );
  return (
    <MantineHeader height={HEADER_HEIGHT} mb={40} className={classes.root}>
      <Container className={classes.header}>
        <Link href="/" passHref>
          <Group>
            <Logo height={35} width={35} />
            <Text weight={600}>{config.get("general.appName")}</Text>
          </Group>
        </Link>
        <Group spacing={5} className={classes.links}>
          <Group>{items} </Group>
        </Group>
        <MediaQuery largerThan="sm" styles={{ display: "none" }}>
          <Burger
            opened={opened}
            onClick={() => toggleOpened.toggle()}
            size="sm"
          />
        </MediaQuery>
        <Transition transition="pop-top-right" duration={200} mounted={opened}>
          {(styles) => (
            <Paper className={classes.dropdown} withBorder style={styles}>
              <Stack spacing={0}> {items}</Stack>
            </Paper>
          )}
        </Transition>
      </Container>
    </MantineHeader>
  );
};

export default Header;
