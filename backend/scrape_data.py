from newspaper import Article
import json
from io import StringIO
import pandas as pd
from ftfy import fix_encoding
import ftfy 

file = open("./bias_data/allsides_20211124_2.csv", "rb").read()
file, decoding = ftfy.guess_bytes(file)
file = StringIO("\n".join(file.splitlines()))
d = pd.read_csv(file)
left = []
right = []
center = []
for i, row in d.iterrows():
    if row.loc["left_link_1"]:
        left.append(row.loc["left_link_1"])
    if row.loc["right_link_1"]:
        right.append(row.loc["right_link_1"])
    if row.loc["center_link_1"]:
        center.append(row.loc["center_link_1"])

def download(link):
    n = Article(link)
    n.download()
    n.parse()

    return n.text, n.title

for i, l in enumerate(left):
    try:
        d = download(l)
        json.dump({"text": d[0], "title": d[1]}, open(f"custom_data/left/{i}.json", "w"))
    except Exception as e:
        print(e)
