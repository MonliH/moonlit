import type { NextApiRequest, NextApiResponse } from "next";

type Data = {
  html: string;
};

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  console.log(req.body);
  fetch(req.body.url, { method: "GET" }).then((r) => {
    r.text().then((html) => {
      res.status(200).send(html as any);
    });
  });
}
