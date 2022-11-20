from fastapi.middleware.cors import CORSMiddleware
from scipy.special import softmax
import numpy as np
from typing import List
import re
from newspaper import Article, ArticleException
from fastapi_cache import FastAPICache
from fastapi_cache.decorator import cache
from fastapi_cache.backends.inmemory import InMemoryBackend
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import dotenv
import os
import openai
from transformers import pipeline, BigBirdForSequenceClassification, AutoTokenizer

from nltk.sentiment.vader import SentimentIntensityAnalyzer


dotenv.load_dotenv(".env")

app = FastAPI()

origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    FastAPICache.init(InMemoryBackend(), prefix="fastapi-cache")


subjective_classifier = pipeline(
    "text-classification", model="cffl/bert-base-styleclassification-subjective-neutral"
)
model = BigBirdForSequenceClassification.from_pretrained("checkpoints/bigbird-1/checkpoint-3840")
tokenizer = AutoTokenizer.from_pretrained("google/bigbird-roberta-base")
def classify_political_lean(lines):
    tokens = tokenizer(lines, max_length=4096, truncation=True, padding="max_length", return_tensors="pt")
    outputs = model(**tokens).logits.detach().numpy()
    logits = softmax(outputs)
    predictions = np.argmax(logits, axis=-1)
    return {"label": predictions.tolist(), "scores": logits.tolist()}

sid = SentimentIntensityAnalyzer()

openai.api_key = os.getenv("API_KEY")
openai.api_base = "https://api.goose.ai/v1"

emotion_template = """Label the emotion that the author of the sentence is trying to create. Choices are joy, inspiration, suprise, anger, disgust, sadness, fear, or neutral.
Setence: "One of the prominent successes of the Canadians today has been stopping the spread of the virus."
Reader's emotion: joy
Setence: "He mislead our entire country! He needs to be fired!"
Reader's emotion: anger
Setence: "Former US President Donald Trump's Twitter account has been reinstated on the platform."
Reader's emotion: neutral
Setence: "And the discovery might provide hope that other bird species thought extinct are still out there somewhere."
Reader's emotion: hope
Sentence: "{text}"
Reader's emotion:"""

def get_related_words(words, negative):
    pos = 0
    result = []
    for word in re.split(r"([^A-Za-z0-9]+)", words):
        if re.match(r"[A-Za-z0-9]+", word):
            scores = sid.polarity_scores(word)
            if (scores["compound"] < 0 and negative) or (scores["compound"] > 0 and not negative):
                result.append({"word": word, "score": scores["compound"], "s": pos, "e": pos+len(word)})
        pos += len(word)
    
    return result

def get_emotion(sentences):
    completion = openai.Completion.create(
        engine="gpt-neo-20b",
        # engine="gpt-neo-125m",
        prompt=[emotion_template.format(text=sentence) for sentence in sentences],
        max_tokens=15,
        temperature=0,
        stop="\n",
    )
    return [
        (label := choice["text"].strip(), (scores := sid.polarity_scores(label)["compound"]), get_related_words(sentence, scores < 0))
        for choice, sentence in zip(completion["choices"], sentences)
    ]


class Texts(BaseModel):
    texts: List[str]


@app.post("/get-emotion")
@cache(expire=600)
async def post_get_emotion(paragraph: Texts):
    return get_emotion(paragraph.texts)


@app.post("/is-biased")
@cache(expire=600)
async def post_get_emotion(paragraphs: Texts):
    return subjective_classifier(paragraphs.texts)

@app.post("/get-side")
@cache(expire=600)
async def classify_politics(paragraphs: Texts):
    return classify_political_lean(paragraphs.texts)

class Url(BaseModel):
    url: str

def process_line(line: str):
    if (
        line.isupper()
        or (line.startswith("NEW ") and line.endswith("!"))
        or line.startswith("WATCH | ")
        or line.startswith("Send this page to someone via email")
        or line.startswith("Story continues below advertisement")
        or line.startswith("FILE -")
        or line.startswith("Now or Never 12:23")
        or not any(map(str.isalnum, line))
    ):
        return None
    if line.startswith("Video Ad Feedback"):
        return line.removeprefix("Video Ad Feedback")

    return line

@app.post("/news-info")
@cache(expire=600)
async def get_news_info(url: Url):
    try:
        n = Article(url.url.strip())
        n.download()
        n.parse()
    except ArticleException as e:
        raise HTTPException(
            status_code=400, detail="URL provided is not a valid news article."
        )

    text = "\n\n".join(
        [
            line
            for l in re.split(r"[\r\n]+", n.text)
            if (line := process_line(l.strip()))
        ]
    )

    return {
        "text": text,
        "title": n.title,
        # Weird edge case with CBC authors
        "authors": n.authors if "cbc.ca" not in url.url else ["CBC Editors"],
        "date": n.publish_date,
        "cover_image": n.top_image,
    }
