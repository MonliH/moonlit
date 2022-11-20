import type { NextPage } from "next";
import { Readability } from "@mozilla/readability";
import Head from "next/head";
import {
  Box,
  Button,
  Divider,
  FormControl,
  FormErrorMessage,
  Heading,
  HStack,
  Image,
  Input,
  Text,
  Tooltip,
  VStack,
} from "@chakra-ui/react";
import { FormEvent, useState } from "react";
import { AlertTriangle, Check } from "react-feather";

interface Annotation {
  emotion?: string;
  subjective: string;
}

interface ArticleData {
  title: string;
  text: string[];
  annotations: (Annotation | null)[];
  authors: string[];
  cover_image: string;
}

function capitalizeFirstLetter(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Article({ article }: { article: ArticleData }) {
  return (
    <Box>
      <Heading width="55%">{article.title}</Heading>
      <Text fontSize="24px" mb="10">
        {article.authors}
      </Text>
      <Image
        mb="6"
        width="55%"
        src={article.cover_image}
        alt={"Title Image"}
        borderRadius="5"
      />
      <Divider mb="6" width="55%" />
      <Box>
        {article.text.map((paragraph, index) => {
          const annotation = article.annotations[index];
          const component = annotation && (
            <HStack
              width="200px"
              fontSize="xs"
              borderLeftWidth="1"
              borderLeftColor="black"
            >
              {annotation.subjective && (
                <Tooltip label="This paragraph may be subjective.">
                  <AlertTriangle color="red" />
                </Tooltip>
              )}
              {annotation.emotion && (
                <>
                  <b>{capitalizeFirstLetter(annotation.emotion)}</b>
                </>
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
              <Text width="50%">{paragraph}</Text>
              {component}
            </HStack>
          );
        })}
      </Box>
    </Box>
  );
}

const Home: NextPage = () => {
  const [url, setUrl] = useState("");
  const [article, setArticle] = useState<null | ArticleData>(null);
  const [articleErr, setArticleErr] = useState<null | string>(null);
  const [fetchingArticle, setFetchingArticle] = useState(false);
  const doFetch = (e: FormEvent) => {
    e.preventDefault();
    (async () => {
      setFetchingArticle(true);
      const res = await fetch("http://localhost:8000/news-info", {
        method: "POST",
        body: JSON.stringify({ url }),
        headers: { "Content-Type": "application/json" },
      });

      (async () => {
        const res = await fetch("/api/scrape", {
          method: "POST",
          body: JSON.stringify({ url }),
          headers: { "Content-Type": "application/json" },
        });
        const doc = new DOMParser().parseFromString(
          await res.text(),
          "text/html"
        );
        const article = new Readability(doc).parse();
        console.log(article);
      })();

      if (res.ok) {
        const doc = await res.json();
        const lines = doc.text.split(/\n+/).map((line: string) => line.trim());
        doc.text = lines;
        doc.annotations = lines.map(() => null);
        setArticle(doc);

        const isNeutral = await fetch("http://localhost:8000/is-biased", {
          method: "POST",
          body: JSON.stringify({ texts: lines }),
          headers: { "Content-Type": "application/json" },
        });
        const isNeutralJson = await isNeutral.json();
        const newDoc = {
          ...doc,
          annotations: isNeutralJson.map(
            ({ label, score }: { label: string; score: number }) =>
              label === "NEUTRAL"
                ? { emotion: undefined, subjective: false }
                : {
                    emotion: "anger",
                    subjective: label === "SUBJECTIVE" && score > 0.7,
                  }
          ),
        };
        const nonNeutralParagraphs = isNeutralJson
          .map(
            ({ label, score }: { label: string; score: number }, idx: number) =>
              label === "NEUTRAL" ? null : idx
          )
          .filter((idx: number | null) => idx !== null);

        const emotionRes = await fetch("http://localhost:8000/get-emotion", {
          method: "POST",
          body: JSON.stringify({
            texts: nonNeutralParagraphs.map((idx: number) => lines[idx]),
          }),
          headers: { "Content-Type": "application/json" },
        });

        const emotion = await emotionRes.json();
        console.log(emotion);

        for (let i = 0; i < emotion.length; i++) {
          const idx = nonNeutralParagraphs[i];
          newDoc.annotations[idx] = {
            emotion: emotion[i],
            subjective: newDoc.annotations[idx]?.subjective,
          };
        }

        setArticle(newDoc);
      } else {
        setArticleErr(
          "We couldn't fetch the news article at that URL. Make sure it's valid."
        );
      }
      setFetchingArticle(false);
    })();
  };

  return (
    <div>
      <Head>
        <title>Moonlit</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Box px="48" py="36">
        <Box mb="12">
          <form onSubmit={doFetch}>
            <FormControl isInvalid={articleErr !== null}>
              <HStack w="75%">
                <Input
                  placeholder="News Article URL"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                ></Input>
                <Button
                  type="submit"
                  isLoading={fetchingArticle}
                  disabled={fetchingArticle}
                >
                  Read
                </Button>
              </HStack>
              <FormErrorMessage>{articleErr}</FormErrorMessage>
            </FormControl>
          </form>
        </Box>
        {article && <Article article={article} />}
      </Box>
    </div>
  );
};

export default Home;
