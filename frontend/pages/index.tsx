import type { NextPage } from "next";
import { Fragment } from "react";
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
  Spinner,
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
  MotionValue,
} from "framer-motion";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

enum PoliticalBias {
  Left = "left",
  Center = "center",
  Right = "right",
}

type Keywords = { word: string; score: number; s: number; e: number }[];

interface Annotation {
  emotion?: [string, number, Keywords];
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

      {article.text.map((paragraph, index) => (
        <Paragraph
          article={article}
          paragraph={paragraph}
          index={index}
          key={index}
          paperAnnotations={paperAnnotations}
        />
      ))}
    </Box>
  );
}

export const highlightText = (
  color: MotionValue<string>,
  darkerColor: MotionValue<string>,
  text: string,
  matched_substring: { s: number; e: number },
  start: number,
  end: number
) => {
  const highlightTextStart = matched_substring.s;
  const highlightTextEnd = matched_substring.e;

  // The part before matched text
  const beforeText = text.slice(start, highlightTextStart);

  // Matched text
  const highlightedText = text.slice(highlightTextStart, highlightTextEnd);

  // Part after matched text
  // Till the end of text, or till next matched text
  const afterText = text.slice(highlightTextEnd, end || text.length);

  // Return in array of JSX elements
  return [
    beforeText,
    <motion.span
      key="0"
      style={{
        borderBottom: "3px solid",
        borderBottomColor: darkerColor,
        padding: "2px",
        paddingTop: "0",
        margin: "-2px",
        marginTop: "0",
        backgroundColor: color,
      }}
    >
      {highlightedText}
    </motion.span>,
    afterText,
  ];
};

export const Highlight = ({
  color,
  darkerColor,
  text,
  matched_substrings,
}: {
  color: MotionValue<string>;
  darkerColor: MotionValue<string>;
  text: string;
  matched_substrings: { s: number; e: number }[];
}) => {
  const returnText = [];

  // Just iterate through all matches
  for (let i = 0; i < matched_substrings.length; i++) {
    const startOfNext = matched_substrings[i + 1]?.s;
    if (i === 0) {
      // If its first match, we start from first character => start at index 0
      returnText.push(
        highlightText(
          color,
          darkerColor,
          text,
          matched_substrings[i],
          0,
          startOfNext
        )
      );
    } else {
      // If its not first match, we start from match.offset
      returnText.push(
        highlightText(
          color,
          darkerColor,
          text,
          matched_substrings[i],
          matched_substrings[i].s,
          startOfNext
        )
      );
    }
  }

  return (
    <>
      {returnText.map((text, i) => (
        <Fragment key={i}>{text}</Fragment>
      ))}
    </>
  );
};

const Paragraph = ({
  article,
  paragraph,
  index,
  paperAnnotations,
}: {
  paragraph: string;
  article: ArticleData;
  index: number;
  paperAnnotations: any;
}) => {
  const annotation = article.annotations
    ? article.annotations[index]
    : undefined;
  const highlight = useSpring(0);
  const isRed = (annotation?.emotion?.[1] ?? 0) < 0;
  const color = useTransform(
    highlight,
    [0, 1],
    [
      isRed ? "rgba(254, 215, 215, 0)" : "rgba(198, 246, 213, 0)",
      isRed ? "rgba(254, 215, 215, 1)" : "rgba(198, 246, 213, 1)",
    ]
  );

  const darkerColor = useTransform(
    highlight,
    [0, 1],
    [
      isRed ? "rgba(229, 62, 62, 0)" : "rgba(56, 161, 105, 0)",
      isRed ? "rgba(229, 62, 62, 1)" : "rgba(56, 161, 105, 1)",
    ]
  );

  const showKeywords = () => {
    highlight.set(1);
  };
  const hideKeywords = () => {
    highlight.set(0);
  };

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
            onMouseEnter={showKeywords}
            onMouseLeave={hideKeywords}
            fontSize={"sm"}
            textTransform={"capitalize"}
            fontWeight={annotation.emotion[0] === "neutral" ? "medium" : "bold"}
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
        {annotation &&
        annotation.emotion?.[1] !== 0 &&
        annotation.emotion?.[2] &&
        annotation.emotion?.[2].length ? (
          <Highlight
            color={color}
            text={paragraph}
            darkerColor={darkerColor}
            matched_substrings={annotation?.emotion?.[2]}
          />
        ) : (
          paragraph
        )}
      </Text>
      <motion.div style={{ opacity: paperAnnotations }}>{component}</motion.div>
    </HStack>
  );
};

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
  const fontSize = useBreakpointValue({ base: "16px", xl: "18px" });
  const width = useBreakpointValue({ base: "300px", xl: "350px" });
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
  const [bias, setBias] = useState<null | undefined | PoliticalBias>(null);

  const doFetch = (e: FormEvent, newU?: string) => {
    e.preventDefault();
    let cUrl = url;
    if (newU) {
      cUrl = newU;
    }
    (async () => {
      setFetchingArticle(true);
      const res = await fetch(`${backendUrl}news-info`, {
        method: "POST",
        body: JSON.stringify({ url: cUrl }),
        headers: { "Content-Type": "application/json" },
      });

      (async () => {
        setBias(undefined);
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
        const leanRes = await fetch(`${backendUrl}get-side`, {
          method: "POST",
          body: JSON.stringify({ texts: [article!.textContent] }),
          headers: { "Content-Type": "application/json" },
        });

        const lean = await leanRes.json();
        const side = [
          PoliticalBias.Center,
          PoliticalBias.Left,
          PoliticalBias.Right,
        ][lean.label[0]];
        const confidence = lean.scores[0];
        setBias(side);
      })();

      if (res.ok) {
        setArticleErr(null);
        const doc = await res.json();
        const lines = doc.text.split(/\n+/).map((line: string) => line.trim());
        doc.text = lines;
        doc.annotations = undefined;
        setArticle(doc);

        const newDoc = {
          ...doc,
          text: [...doc.text],
        };

        const emotionRes = await fetch(`${backendUrl}get-emotion`, {
          method: "POST",
          body: JSON.stringify({
            texts: newDoc.text,
          }),
          headers: { "Content-Type": "application/json" },
        });

        const emotion = await emotionRes.json();
        newDoc.annotations = emotion.map(
          (emotion: [string, number, Keywords]) => ({
            emotion,
          })
        );

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
          <Box pt="8">
            <HStack mb="2" alignItems={"center"} height="27px">
              <Text>Detected political leaning:</Text>
              {bias === undefined && <Spinner size="sm" />}
              {bias !== null && bias !== undefined && (
                <Badge
                  fontSize={"lg"}
                  colorScheme={
                    bias === PoliticalBias.Left
                      ? "blue"
                      : bias === PoliticalBias.Right
                      ? "red"
                      : "yellow"
                  }
                >
                  {bias === PoliticalBias.Left
                    ? "Left"
                    : bias === PoliticalBias.Right
                    ? "Right"
                    : "Center"}
                </Badge>
              )}
            </HStack>
            {<Article article={article} />}
          </Box>
        ) : (
          <VStack>
            <Heading my="4" as="h2" fontSize="25px" fontWeight="regular">
              Or, try a sample article:
            </Heading>
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
                    "https://apnews.com/article/elon-musk-biden-twitter-inc-technology-congress-d88e3de4b3cc095926dc133f53dc3320"
                  )}
                  src={"/sample_d.jpeg"}
                  name={
                    "Musk restores Trump’s Twitter account after online poll"
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
