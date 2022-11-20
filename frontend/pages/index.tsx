import type { NextPage } from "next";
import { Readability } from "@mozilla/readability";
import Head from "next/head";
import NextImage from "next/image";
import {
  Badge,
  Box,
  Button,
  Divider,
  FormControl,
  FormErrorMessage,
  Grid,
  GridItem,
  Heading,
  HStack,
  Image,
  Input,
  Text,
  Tooltip,
  useBreakpointValue,
  VStack,
} from "@chakra-ui/react";
import { FormEvent, useEffect, useState } from "react";
import { AlertTriangle, Check, Edit2 } from "react-feather";
import Link from "next/link";
import { chakra } from "@chakra-ui/react";
import {
  motion,
  isValidMotionProp,
  useTransform,
  useSpring,
} from "framer-motion";

const ChakraBox = chakra(motion.div, {
  shouldForwardProp: isValidMotionProp,
});

interface Annotation {
  emotion?: [string, number];
  subjective: string;
}

interface ArticleData {
  title: string;
  text: string[];
  annotations?: Annotation[];
  authors: string[];
  cover_image: string;
}

function capitalizeFirstLetter(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Article({ article }: { article: ArticleData }) {
  const paperAnnotations = useSpring(0);

  useEffect(() => {
    if (article.annotations) {
      paperAnnotations.set(1);
    } else {
      paperAnnotations.set(0);
    }
  }, [article]);

  return (
    <Box>
      <Heading width={{ lg: "65%", xl: "55%" }} mb="4">
        {article.title}
      </Heading>
      <Text fontSize="24px" mb="10">
        {article.authors.join(", ")}
      </Text>
      <Image
        mb="6"
        width={{ lg: "65%", xl: "55%" }}
        src={article.cover_image}
        alt={"Title Image"}
        borderRadius="5"
      />
      <Divider mb="6" width={{ lg: "63%", xl: "55%" }} />

      {article.text.map((paragraph, index) => {
        const annotation = article.annotations
          ? article.annotations[index]
          : undefined;
        const component = annotation && (
          <HStack width="200px" fontSize="xs">
            {annotation.emotion && (
              <Tooltip
                label={
                  annotation.emotion[0] === "neutral"
                    ? `This paragraph is mostly neutral.`
                    : `This paragraph may cause feelings of ${annotation.emotion[0]}.`
                }
              >
                <Badge
                  fontSize={"sm"}
                  textTransform={"capitalize"}
                  fontWeight={
                    annotation.emotion[0] === "neutral" ? "medium" : "bold"
                  }
                  py="2px"
                  px="6px"
                  variant={"subtle"}
                  colorScheme={
                    annotation.emotion[0] == "neutral"
                      ? "gray"
                      : annotation.emotion[1] > 0
                      ? "green"
                      : "red"
                  }
                >
                  {capitalizeFirstLetter(annotation.emotion[0])}
                </Badge>
              </Tooltip>
            )}
            {!annotation.emotion && !annotation.subjective && (
              <Tooltip label="This paragraph is neutral.">
                <Check color="green" />
              </Tooltip>
            )}
          </HStack>
        );
        return (
          <HStack key={index} mb="6">
            <Text
              width={{ lg: "65%", xl: "53%" }}
              pr="6"
              mr="2"
              borderRightWidth="1px"
            >
              {paragraph}
            </Text>
            <motion.div style={{ opacity: paperAnnotations }}>
              {component}
            </motion.div>
          </HStack>
        );
      })}
    </Box>
  );
}

const ImageLink = ({
  onClick,
  name,
  src,
}: {
  name: string;
  src: string;
  onClick: () => void;
}) => {
  const spring = useSpring(0);
  const fontSize = useBreakpointValue({base:"16px",xl: "18px"})
  const width = useBreakpointValue({base:"300px",xl: "350px"})
  return (
    <motion.div
      style={{
        backgroundImage: `url(${src})`,
        backgroundSize: "cover",
        width: width,
        height: "150px",
        textAlign: "center",
        borderRadius: "10px",
        fontSize,
      }}
      onClick={onClick}
      role="button"
      onMouseEnter={() => spring.set(1)}
      onMouseLeave={() => spring.set(0)}
    >
      <motion.div
        style={{
          color: "white",
          backgroundColor: "rgba(0, 0, 0, 0.6)",
          opacity: spring,
          width: "100%",
          height: "100%",
          borderRadius: "10px",
          padding: "25px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {name}
      </motion.div>
    </motion.div>
  );
};

const Home: NextPage = () => {
  const [url, setUrl] = useState("");
  const [article, setArticle] = useState<null | ArticleData>(null);
  const [articleErr, setArticleErr] = useState<null | string>(null);
  const [fetchingArticle, setFetchingArticle] = useState(false);
  const doFetch = (e: FormEvent, newU?: string) => {
    e.preventDefault();
    let cUrl = url;
    if (newU) {
      cUrl = newU;
    }
    console.log(cUrl, newU);
    (async () => {
      setFetchingArticle(true);
      const res = await fetch("http://localhost:8000/news-info", {
        method: "POST",
        body: JSON.stringify({ url: cUrl }),
        headers: { "Content-Type": "application/json" },
      });

      (async () => {
        const res = await fetch("/api/scrape", {
          method: "POST",
          body: JSON.stringify({ url: cUrl }),
          headers: { "Content-Type": "application/json" },
        });
        const doc = new DOMParser().parseFromString(
          await res.text(),
          "text/html"
        );
        const article = new Readability(doc).parse();
      })();

      if (res.ok) {
        setArticleErr(null);
        const doc = await res.json();
        const lines = doc.text.split(/\n+/).map((line: string) => line.trim());
        doc.text = lines;
        doc.annotations = undefined;
        setArticle(doc);

        // const isNeutral = await fetch("http://localhost:8000/is-biased", {
        //   method: "POST",
        //   body: JSON.stringify({ texts: lines }),
        //   headers: { "Content-Type": "application/json" },
        // });
        // const isNeutralJson = await isNeutral.json();
        // const newDoc = {
        //   ...doc,
        //   annotations: isNeutralJson.map(
        //     ({ label, score }: { label: string; score: number }) =>
        //       label === "NEUTRAL"
        //         ? { emotion: undefined, subjective: false }
        //         : {
        //             emotion: undefined,
        //             subjective: label === "SUBJECTIVE" && score > 0.7,
        //           }
        //   ),
        // };
        // const nonNeutralParagraphs = isNeutralJson
        //   .map(
        //     ({ label, score }: { label: string; score: number }, idx: number) =>
        //       label === "NEUTRAL" ? null : idx
        //   )
        //   .filter((idx: number | null) => idx !== null);

        const newDoc = {
          ...doc,
          text: [...doc.text],
        };

        const emotionRes = await fetch("http://localhost:8000/get-emotion", {
          method: "POST",
          body: JSON.stringify({
            texts: newDoc.text,
          }),
          headers: { "Content-Type": "application/json" },
        });

        const emotion = await emotionRes.json();
        newDoc.annotations = emotion.map((emotion: [string, number]) => ({
          emotion,
        }));

        setArticle(newDoc);
      } else {
        setArticleErr(
          "We couldn't fetch the news article at that URL. Make sure it's valid."
        );
      }
      setFetchingArticle(false);
    })();
  };

  const reset = () => {
    setArticle(null);
    setArticleErr(null);
    setUrl("");
  };

  const linkTo = (url: string) => () => {
    reset();
    setUrl(url);
    console.log(url)
    doFetch({ preventDefault: () => {} } as FormEvent, url);
  };

  return (
    <>
      <Head>
        <title>Moonlit</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <VStack px={{ lg: "36", xl: "48" }} py="24" width="100%">
        <VStack
          mb="6"
          alignItems={article ? "flex-start" : "center"}
          width="100%"
        >
          <Button
            onClick={reset}
            textDecoration="none"
            background="none"
            border="none"
            padding="0"
            cursor="pointer"
            outline="inherit"
            height="fit-content"
            width={{ lg: "50%", xl: "40%" }}
            _hover={{}}
          >
            <Image src="/Logo.svg" width="100%" alt="Moonlit" />
          </Button>
          <Text pb={article ? "3" : "12"} fontSize={"2xl"}>
            Illuminate your information.
          </Text>
          <form onSubmit={doFetch}>
            <FormControl isInvalid={articleErr !== null} width="100%">
              <HStack>
                <Input
                  w="40vw"
                  placeholder="News Article URL"
                  value={url}
                  size="lg"
                  onChange={(e) => setUrl(e.target.value)}
                ></Input>
                <Button
                size="lg"
                  type="submit"
                  colorScheme={"green"}
                  isLoading={fetchingArticle}
                  disabled={fetchingArticle}
                >
                  Annotate
                </Button>
              </HStack>
              <FormErrorMessage>{articleErr}</FormErrorMessage>
            </FormControl>
          </form>
        </VStack>
        <Divider width="60%" />
        {article ? (
          <Box pt="8">{<Article article={article} />}</Box>
        ) : (
          <VStack>
            <Heading my="4" as="h2" fontSize="25px" fontWeight="regular">Or, try a sample article:</Heading>
            <Grid
              templateColumns="repeat(2, 1fr)"
              templateRows="repeat(2, 1fr)"
              gap="4"
            >
              <GridItem>
                <ImageLink
                  onClick={linkTo(
                    "https://globalnews.ca/news/9290333/alberta-premier-danielle-smith-bleak-role-model-fired-health-leader/"
                  )}
                  src={"/sample_a.webp"}
                  name={
                    "‘Warped stance on COVID’: Fired Alberta Health Services board member calls out Smith"
                  }
                />
              </GridItem>
              <GridItem>
                <ImageLink
                  onClick={linkTo(
                    "https://globalnews.ca/news/9290889/alberta-chief-danielle-smith-indigenous-roots-cherokee/"
                  )}
                  src={"/sample_b.webp"}
                  name={
                    "Alberta chief critical of Premier Danielle Smith’s claim of Indigenous roots"
                  }
                />
              </GridItem>
              <GridItem>
                <ImageLink
                  onClick={linkTo(
                    "https://www.foxnews.com/opinion/pro-abortion-forces-broke-bank-convince-voters-abortion-extremism-is-normal-they-failed"
                  )}
                  src={"/sample_c.webp"}
                  name={
                    "Pro-abortion forces broke the bank to convince voters abortion extremism is normal. They failed."
                  }
                />
              </GridItem>
              <GridItem>
                <ImageLink
                  onClick={linkTo(
                    "https://www.cbc.ca/radio/nowornever/celebrating-everyday-heroes-1.6501032/my-brother-was-my-hero-i-try-to-remember-that-even-after-his-suicide-1.6509687"
                  )}
                  src={"/sample_d.webp"}
                  name={
                    "My brother was my hero. I try to remember that even after his suicide"
                  }
                />
              </GridItem>
            </Grid>
          </VStack>
        )}
      </VStack>
    </>
  );
};

export default Home;
