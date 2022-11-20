from transformers import AutoTokenizer, BigBirdForSequenceClassification
import re
import wandb
from transformers import TrainingArguments, Trainer
import datasets
import os

os.environ["CUDA_VISIBLE_DEVICES"] = "0,1,2,3"

wandb.init(project="news", entity="jonatli")

tokenizer = AutoTokenizer.from_pretrained("google/bigbird-roberta-base")
model = BigBirdForSequenceClassification.from_pretrained(
    "google/bigbird-roberta-base", num_labels=3
)

data = datasets.load_from_disk("./AllSides/hf_dataset")
print(data)
label_list = ["center", "left", "right"]
label2id = {l: i for i, l in enumerate(label_list)}
id2label = {id: label for label, id in label2id.items()}


def process(r):
    r["texts"] = re.sub(" +", " ", r["texts"])
    r["label"] = label2id[r["labels"]]
    return r


def tokenize(r):
    return tokenizer(
        r["texts"][:25000], max_length=4096, padding="max_length", truncation=True
    )


new_ds = data.map(process)
new_ds = new_ds.map(tokenize, num_proc=16)
print(new_ds["train"]["input_ids"][0])

import numpy as np
import evaluate

metric = evaluate.load("accuracy")
metric_f1 = evaluate.load("f1")


def compute_metrics(eval_pred):
    logits, labels = eval_pred
    predictions = np.argmax(logits, axis=-1)
    m = metric.compute(predictions=predictions, references=labels) | metric_f1.compute(
        predictions=predictions, references=labels, average="macro"
    )
    return m


training_args = TrainingArguments(
    output_dir="checkpoints/bigbird-1",
    evaluation_strategy="steps",
    eval_steps=128,
    save_strategy="steps",
    save_steps=128,
    logging_strategy="steps",
    logging_steps=16,
    num_train_epochs=3,
    warmup_ratio=0.05,
    per_device_train_batch_size=1,
    per_device_eval_batch_size=10,
    fp16=True,
)

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=new_ds["train"],
    eval_dataset=new_ds["test"],
    compute_metrics=compute_metrics,
)

trainer.train(
    resume_from_checkpoint="checkpoints/bigbird-1/checkpoint-3840",
)
