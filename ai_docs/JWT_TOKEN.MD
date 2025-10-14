MastraJwtAuth Class
The MastraJwtAuth class provides a lightweight authentication mechanism for Mastra using JSON Web Tokens (JWTs). It verifies incoming requests based on a shared secret and integrates with the Mastra server using the experimental_auth option.

Installation
Before you can use the MastraJwtAuth class you have to install the @mastra/auth package.


npm install @mastra/auth@latest
Usage example
src/mastra/index.ts

import { Mastra } from "@mastra/core/mastra";
import { MastraJwtAuth } from '@mastra/auth';
 
export const mastra = new Mastra({
  // ..
  server: {
    experimental_auth: new MastraJwtAuth({
        secret: process.env.MASTRA_JWT_SECRET
    }),
  },
});
See the MastraJwtAuth API reference for all available configuration options.

Configuring MastraClient
When experimental_auth is enabled, all requests made with MastraClient must include a valid JWT in the Authorization header:

lib/mastra/mastra-client.ts

import { MastraClient } from "@mastra/client-js";
 
export const mastraClient = new MastraClient({
  baseUrl: "https://<mastra-api-url>",
  headers: {
    Authorization: `Bearer ${process.env.MASTRA_JWT_TOKEN}`
  }
});
See Mastra Client SDK for more configuration options.

Making authenticated requests
Once MastraClient is configured, you can send authenticated requests from your frontend application, or use curl for quick local testing:

src/components/test-agent.tsx

import { mastraClient } from "../../lib/mastra-client";
 
export const TestAgent = () => {
  async function handleClick() {
    const agent = mastraClient.getAgent("weatherAgent");
 
    const response = await agent.generate({
      messages: "Weather in London"
    });
 
    console.log(response);
  }
 
  return <button onClick={handleClick}>Test Agent</button>;
};
Creating a JWT
To authenticate requests to your Mastra server, you’ll need a valid JSON Web Token (JWT) signed with your MASTRA_JWT_SECRET.

The easiest way to generate one is using jwt.io :

Select JWT Encoder.
Scroll down to the Sign JWT: Secret section.
Enter your secret (for example: supersecretdevkeythatishs256safe!).
Click Generate example to create a valid JWT.
Copy the generated token and set it as MASTRA_JWT_TOKEN in your .env file.