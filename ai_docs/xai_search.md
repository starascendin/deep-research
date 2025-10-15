Live Search
The advanced agentic search capabilities powering grok.com are not yet available in the Live Search API. We're actively working on integrating them.

The chat completion endpoint supports querying live data and considering those in generating responses. With this functionality, instead of orchestrating web search and LLM tool calls yourself, you can get chat responses with live data directly from the API.

Live search is available via the chat completions endpoint. It is turned off by default. Customers have control over the content they access, and we are not liable for any resulting damages or liabilities.

For more details, refer to 
search_parameters
 in API Reference - Chat completions.

For examples on search sources, jump to Data Sources and Parameters.

Live Search Pricing
Live Search costs $25 per 1,000 sources used. That means each source costs $0.025.

The number of sources used can be found in the 
response
 object, which contains a field called 
response.usage.num_sources_used
.

Enabling Search
To enable search, you need to specify in your chat completions request an additional field 
search_parameters
, with 
"mode"
 from one of 
"auto"
, 
"on"
, 
"off"
.

If you want to use Live Search with default values, you still need to specify an empty 
search_parameters
.

json


"search_parameters": {}
Or if using xAI Python SDK:

python


search_parameters=SearchParameters(),
The 
"mode"
 field sets the preference of data source: - 
"off"
: Disables search and uses the model without accessing additional information from data sources. - 
"auto"
 (default): Live search is available to the model, but the model automatically decides whether to perform live search. - 
"on"
: Enables live search.

The model decides which data source to use within the provided data sources, via the 
"sources"
 field in 
"search_parameters"
. If no 
"sources"
 is provided, live search will default to making web and X data available to the model.

For example, you can send the following request, where the model will decide whether to search in data:


python (requests)


import os
import requests

url = "https://api.x.ai/v1/chat/completions"
headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {os.getenv('XAI_API_KEY')}"
}
payload = {
    "messages": [
        {
            "role": "user",
            "content": "Provide me a digest of world news of the week before July 9, 2025."
        }
    ],
    "search_parameters": {
        "mode": "auto"
    },
    "model": "grok-4"
}

response = requests.post(url, headers=headers, json=payload)
print(response.json())
Returning citations
The live search endpoint supports returning citations to the data sources used in the response in the form of a list of URLs. To enable this, you can set 
"return_citations": true
 in your search parameters. This field defaults to 
true
.


python (requests)


import os
import requests

url = "https://api.x.ai/v1/chat/completions"
headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {os.getenv('XAI_API_KEY')}"
}
payload = {
    "messages": [
        {
            "role": "user",
            "content": "Provide me a digest of world news on July 9, 2025."
        }
    ],
    "search_parameters": {
        "mode": "auto",
        "return_citations": True
    },
    "model": "grok-4"
}

response = requests.post(url, headers=headers, json=payload)
print(response.json())
Streaming behavior with citations
During streaming, you would get the chat response chunks as usual. The citations will be returned as a list of url strings in the field 
"citations"
 only in the last chunk. This is similar to how the usage data is returned with streaming.

Set date range of the search data
You can restrict the date range of search data used by specifying 
"from_date"
 and 
"to_date"
. This limits the data to the period from 
"from_date"
 to 
"to_date"
, including both dates.

Both fields need to be in ISO8601 format, e.g. "YYYY-MM-DD". If you're using the xAI Python SDK, the 
from_date
 and 
to_date
 fields can be passed as 
datetime.datetime
 objects to the 
SearchParameters
 class.

The fields can also be independently used. With only 
"from_date"
 specified, the data used will be from the 
"from_date"
 to today, and with only 
"to_date"
 specified, the data used will be all data till the 
"to_date"
.


python (requests)


import os
import requests

url = "https://api.x.ai/v1/chat/completions"
headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {os.getenv('XAI_API_KEY')}"
}
payload = {
    "messages": [
        {
            "role": "user",
            "content": "What is the most viral meme in 2022?"
        }
    ],
    "search_parameters": {
        "mode": "auto",
        "from_date": "2022-01-01",
        "to_date": "2022-12-31"
    },
    "model": "grok-4"
}

response = requests.post(url, headers=headers, json=payload)
print(response.json())
Limit the maximum amount of data sources
You can set a limit on how many data sources will be considered in the query via 
"max_search_results"
. The default limit is 20.


python (requests)


import os
import requests

url = "https://api.x.ai/v1/chat/completions"
headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {os.getenv('XAI_API_KEY')}"
}
payload = {
    "messages": [
        {
            "role": "user",
            "content": "Can you recommend the top 10 burger places in London?"
        }
    ],
    "search_parameters": {
        "mode": "auto",
        "max_search_results": 10
    },
    "model": "grok-4"
}

response = requests.post(url, headers=headers, json=payload)
print(response.json())
Data sources and parameters
In 
"sources"
 of 
"search_parameters"
, you can add a list of sources to be potentially used in search. Each source is an object with source name and parameters for that source, with the name of the source in the 
"type"
 field.

If nothing is specified, the sources to be used will default to 
"web"
, 
"news"
 and 
"x"
.

For example, the following enables web, X search, news and rss:

json


"sources": [
  {"type": "web"},
  {"type": "x"},
  {"type": "news"}
  {"type": "rss"}
]
Overview of data sources and supported parameters
Data Source	Description	Supported Parameters
"web"
Searching on websites.	
"country"
, 
"excluded_websites"
, 
"allowed_websites"
, 
"safe_search"
"x"
Searching X posts.	
"included_x_handles"
, 
"excluded_x_handles"
, 
"post_favorite_count"
, 
"post_view_count"
"news"
Searching from news sources.	
"country"
, 
"excluded_websites"
, 
"safe_search"
"rss"
Retrieving data from the RSS feed provided.	
"links"
Parameter 
"country"
 (Supported by Web and News)
Sometimes you might want to include data from a specific country/region. To do so, you can add an ISO alpha-2 code of the country to 
"country"
 in 
"web"
 or 
"news"
 of the 
"sources"
.


python (requests)


import os
import requests

url = "https://api.x.ai/v1/chat/completions"
headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {os.getenv('XAI_API_KEY')}"
}
payload = {
    "messages": [
        {
            "role": "user",
            "content": "Where is the best place to go skiing this year?"
        }
    ],
    "search_parameters": {
        "mode": "auto",
        "sources": [{ "type": "web", "country": "CH" }]
    },
    "model": "grok-4"
}

response = requests.post(url, headers=headers, json=payload)
print(response.json())
Parameter 
"excluded_websites"
 (Supported by Web and News)
Use 
"excluded_websites"
to exclude websites from the query. You can exclude a maximum of five websites.

This cannot be used with 
"allowed_websites"
 on the same search source.


python (requests)


import os
import requests

url = "https://api.x.ai/v1/chat/completions"
headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {os.getenv('XAI_API_KEY')}"
}
payload = {
    "messages": [
        {
            "role": "user",
            "content": "What are some recently discovered alternative DNA shapes?"
        }
    ],
    "search_parameters": {
        "mode": "auto",
        "sources": [
            { "type": "web", "excluded_websites": ["wikipedia.org"] },
            { "type": "news", "excluded_websites": ["bbc.co.uk"] }
        ]
    },
    "model": "grok-4"
}

response = requests.post(url, headers=headers, json=payload)
print(response.json())
Parameter 
"allowed_websites"
 (Supported by Web)
Use 
"allowed_websites"
to allow only searching on these websites for the query. You can include a maximum of five websites.

This cannot be used with 
"excluded_websites"
 on the same search source.


python (requests)


import os
import requests

url = "https://api.x.ai/v1/chat/completions"
headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {os.getenv('XAI_API_KEY')}"
}
payload = {
    "messages": [
        {
            "role": "user",
            "content": "What are the latest releases at xAI?"
        }
    ],
    "search_parameters": {
        "mode": "auto",
        "sources": [
            { "type": "web", "allowed_websites": ["x.ai"] },
        ]
    },
    "model": "grok-4"
}

response = requests.post(url, headers=headers, json=payload)
print(response.json())
Parameter 
"included_x_handles"
 (Supported by X)
Use 
"included_x_handles"
 to consider X posts only from a given list of X handles. The maximum number of handles you can include is 10.

This parameter cannot be set together with 
"excluded_x_handles"
.


python (requests)


import os
import requests

url = "https://api.x.ai/v1/chat/completions"
headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {os.getenv('XAI_API_KEY')}"
}
payload = {
    "messages": [
        {
            "role": "user",
            "content": "What are the latest updates from xAI?"
        }
    ],
    "search_parameters": {
        "mode": "auto",
        "sources": [{ "type": "x", "included_x_handles": ["xai"] }]
    },
    "model": "grok-4"
}

response = requests.post(url, headers=headers, json=payload)
print(response.json())
Parameter 
"excluded_x_handles"
 (Supported by X)
Use 
"excluded_x_handles"
 to exclude X posts from a given list of X handles. The maximum number of handles you can exclude is 10.

This parameter cannot be set together with 
"included_x_handles"
.

To prevent the model from citing itself in its responses, the 
"grok"
 handle is automatically excluded by default. If you want to include posts from 
"grok"
 in your search, you must pass it explicitly in the 
"included_x_handles"
 parameter.


python (requests)


import os
import requests

url = "https://api.x.ai/v1/chat/completions"
headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {os.getenv('XAI_API_KEY')}"
}
payload = {
    "messages": [
        {
            "role": "user",
            "content": "What are people saying about xAI?"
        }
    ],
    "search_parameters": {
        "mode": "auto",
        "sources": [{ "type": "x", "excluded_x_handles": ["xai"] }]
    },
    "model": "grok-4"
}

response = requests.post(url, headers=headers, json=payload)
print(response.json())
Parameters 
"post_favorite_count"
 and 
"post_view_count"
 (Supported by X)
Use 
"post_favorite_count"
 and 
"post_view_count"
 to filter X posts by the number of favorites and views they have. Only posts with at least the specified number of favorites/views will be considered.

You can set both parameters to consider posts with at least the specified number of favorites and views.


python (requests)


import os
import requests

url = "https://api.x.ai/v1/chat/completions"
headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {os.getenv('XAI_API_KEY')}"
}
payload = {
    "messages": [
        {
            "role": "user",
            "content": "What are people saying about xAI?"
        }
    ],
    "search_parameters": {
        "mode": "auto", # Only consider posts with at least 1000 favorites and 20000 views
        "sources": [{ "type": "x", "post_favorite_count": 1000, "post_view_count": 20000 }]
    },
    "model": "grok-4"
}

response = requests.post(url, headers=headers, json=payload)
print(response.json())
Parameter 
"link"
 (Supported by RSS)
You can also fetch data from a list of RSS feed urls via 
{ "links": ... }
. You can only add one RSS link at the moment.

For example:


python (requests)


import os
import requests

url = "https://api.x.ai/v1/chat/completions"
headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {os.getenv('XAI_API_KEY')}"
}
payload = {
    "messages": [
        {
            "role": "user",
            "content": "What are the latest updates on Grok?"
        }
    ],
    "search_parameters": {
        "mode": "on",
        "sources": [{"type": "rss", "links": ["https://status.x.ai/feed.xml"]}]
    },
    "model": "grok-4"
}

response = requests.post(url, headers=headers, json=payload)
print(response.json())
Parameter 
"safe_search"
 (Supported by Web and News)
Safe search is on by default. You can disable safe search for 
"web"
 and 
"news"
 via 
"sources": [{..., "safe_search": false }]
.