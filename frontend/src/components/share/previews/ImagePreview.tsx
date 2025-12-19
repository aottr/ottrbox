import { Box, createStyles } from "@mantine/core";
import Image from "next/image";

type ImagePreviewProps = {
  shareId: string;
  fileId: string;
};

const useStyles = createStyles((theme) => ({
  image: {
    borderRadius: theme.radius.sm,
    objectFit: 'cover',
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: '1/1',
  },
}));

export const ImagePreview = ({ shareId, fileId }: ImagePreviewProps) => {
  const { classes } = useStyles();
  return (
    <Box className={classes.imageContainer}>
      <Image
        src={`/api/shares/${shareId}/files/${fileId}?download=false`}
        alt={`${fileId}_preview`}
        fill
        className={classes.image}
      />
    </Box>
  );
};