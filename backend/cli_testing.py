# import transformers
# from transformers import pipeline

# passage = """For all the attention paid to Danielle Smith's proposed Sovereignty Act, the real galvanizing force behind her United Conservative Party leadership was her fixation on re-litigating the COVID rules she and her base so strongly opposed.
# But those are views shared by only a minority of Albertans and a slim majority of UCP supporters, according to new polling data commissioned by CBC News.
# Before entering the race, Smith had promoted on her radio show COVID treatments such as hydroxychloroquine and ivermectin. She was so skeptical of vaccines that she flew to Arizona to take the Johnson & Johnson shot because it was not mRNA, and admitted that she only did so because of coercions that would have limited her ability to travel.
# During the race, Smith promised no more school masking or remote learning. Smith also pledged to change the Alberta Human Rights Act to make vaccine status a protected class.
# So naturally, after she became premier she continued to want to re-litigate COVID, and she's been doing so often."""

# # model = transformers.AutoModel.from_pretrained(
# #     "cffl/bart-base-styletransfer-subjective-to-neutral"
# # )
# t2t = pipeline("text-classification", model="cffl/bert-base-styleclassification-subjective-neutral")
# for line in passage.splitlines():
#     print(t2t(line), line)
from nltk.sentiment.vader import SentimentIntensityAnalyzer
sid = SentimentIntensityAnalyzer()
print(sid.polarity_scores('bad'))

