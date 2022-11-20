from fastapi.middleware.cors import CORSMiddleware
from typing import List
import re
from newspaper import Article, ArticleException
from fastapi_cache import FastAPICache
from fastapi_cache.backends.inmemory import InMemoryBackend
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import dotenv
import os
import openai 
from transformers import pipeline

subjective_classifier = pipeline("text-classification", model="cffl/bert-base-styleclassification-subjective-neutral")

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

openai.api_key = os.getenv("API_KEY")
openai.api_base = "https://api.goose.ai/v1"

emotion_template = """Label the emotion that the author of the sentence is trying to create. Choices are joy, inspiration, suprise, anger, disgust, sadness, and fear.
Setence: "One of the prominent successes of the Canadians today has been stopping the spread of the virus."
Reader's emotion: joy
Setence: "He mislead our entire country! He needs to be fired!"
Reader's emotion: anger
Setence: "And the discovery might provide hope that other bird species thought extinct are still out there somewhere."
Reader's emotion: hope
Sentence: "{text}"
Reader's emotion:"""


def get_emotion(sentences):
    completion = openai.Completion.create(
        engine="gpt-neo-125m",
        prompt=[emotion_template.format(text=sentence) for sentence in sentences],
        max_tokens=15,
        temperature=0,
        stop="\n"
    )
    return [choice["text"].strip() for choice in completion["choices"]]

class Texts(BaseModel):
    texts: List[str]

@app.post("/get-emotion")
async def post_get_emotion(paragraph: Texts):
    return get_emotion(paragraph.texts)

@app.post("/is-biased")
async def post_get_emotion(paragraphs: Texts):
    return subjective_classifier(paragraphs.texts)

class Url(BaseModel):
    url: str

def process_line(line: str):
    if line.isupper() or (line.startswith("NEW ") and line.endswith("!")):
        return None
    if line.startswith("Video Ad Feedback"):
        return line.removeprefix("Video Ad Feedback")
    
    return line

@app.post("/news-info")
async def get_news_info(url: Url):
    try:
        n = Article(url.url)
        n.download()
        n.parse()
    except ArticleException as e:
        raise HTTPException(status_code=400, detail="URL provided is not a valid news article.")

    text = "\n\n".join([line for l in re.split(r"[\r\n]+", n.text) if (line := process_line(l.strip()))])

    return {"text": text, "title": n.title, "authors": n.authors, "date": n.publish_date, "cover_image": n.top_image}