from fastapi.middleware.cors import CORSMiddleware
from fastapi_cache import FastAPICache
from fastapi_cache.backends.inmemory import InMemoryBackend
from fastapi import FastAPI
from pydantic import BaseModel
import dotenv
import os
import openai 
from transformers import pipeline

t2t = pipeline("text-classification", model="cffl/bert-base-styleclassification-subjective-neutral")

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

emotion_template = """Label the emotion that the author of the sentence is trying to create.
Sentence: "The poor, sad, hungry, Africans"
Reader's emotion: pity
Setence: "He mislead our entire country! He needs to be fired!"
Reader's emotion: anger
Sentence: "{text}"
Reader's emotion:"""


def get_emotion(sentence):
    completion = openai.Completion.create(
        engine="gpt-j-6b",
        prompt=emotion_template.format(text=sentence),
        max_tokens=15,
        temperature=0,
        stop="\n"
    )
    possible_verb = completion["choices"][0]["text"].strip()
    return possible_verb

class Paragraph(BaseModel):
    text: str

@app.post("/get-emotion")
async def post_get_emotion(paragraph: Paragraph):
    return {"emotion": get_emotion(paragraph)}
