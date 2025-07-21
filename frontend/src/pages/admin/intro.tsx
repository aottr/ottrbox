import {
  Anchor,
  Button,
  Center,
  Container,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import Link from "next/link";
import Logo from "../../components/Logo";
import Meta from "../../components/Meta";

const Intro = () => {
  return (
    <>
      <Meta title="Intro" />
      <Container size="xs">
        <Stack>
          <Center>
            <Logo height={80} width={80} />
          </Center>
          <Center>
            <Title order={2}>Welcome to OttrBox</Title>
          </Center>
          <Text>
            If you enjoy OttrBox please ⭐️ it on{" "}
            <Anchor
              target="_blank"
              href="https://github.com/aottr/ottrbox"
            >
              GitHub
            </Anchor>{" "}
            or{" "}
            <Anchor
              target="_blank"
              href="https://github.com/sponsors/aottr"
            >
              buy me a coffee
            </Anchor>{" "}
            if you want to support my work.
          </Text>
          <Text>Enough talked, have fun with OttrBox!</Text>
          <Text mt="lg">How to you want to continue?</Text>
          <Stack>
            <Button href="/admin/config/general" component={Link}>
              Customize configuration
            </Button>
            <Button href="/" component={Link} variant="light">
              Explore OttrBox
            </Button>
          </Stack>
        </Stack>
      </Container>
    </>
  );
};

export default Intro;
