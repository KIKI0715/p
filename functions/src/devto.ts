import axios from 'axios';

const DEVTO_API_BASE = 'https://dev.to/api';

export interface DevtoPublishResult {
  id: number;
  url: string;
}

export async function publishArticle(
  apiKey: string,
  title: string,
  content: string,
  tags: string[]
): Promise<DevtoPublishResult> {
  const response = await axios.post(
    `${DEVTO_API_BASE}/articles`,
    {
      article: {
        title,
        body_markdown: content,
        tags,
        published: true,
      },
    },
    {
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
    }
  );
  return {
    id: response.data.id as number,
    url: response.data.url as string,
  };
}
