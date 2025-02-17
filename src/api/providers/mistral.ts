import { Anthropic } from "@anthropic-ai/sdk"
import { Mistral } from "@mistralai/mistralai"
import { withRetry } from "../retry"
import { ApiHandler } from "../"
import {
	ApiHandlerOptions,
	mistralDefaultModelId,
	MistralModelId,
	mistralModels,
	ModelInfo,
	openAiNativeDefaultModelId,
	OpenAiNativeModelId,
	openAiNativeModels,
} from "../../shared/api"
import { convertToMistralMessages } from "../transform/mistral-format"
import { ApiStream } from "../transform/stream"

export class MistralHandler implements ApiHandler {
	private options: ApiHandlerOptions
	private client: Mistral
	private lastRequestTime: number = 0

	constructor(options: ApiHandlerOptions) {
		this.options = options
		this.client = new Mistral({
			serverURL: "https://api.mistral.ai",
			apiKey: this.options.mistralApiKey,
		})
	}

	private async waitIfNeeded() {
		const now = Date.now()
		const timeSinceLastRequest = now - this.lastRequestTime
		const minDelay = 30000 // 30 secondes en millisecondes
		this.lastRequestTime = now

		if (timeSinceLastRequest < minDelay) {
			await new Promise((resolve) => setTimeout(resolve, minDelay - timeSinceLastRequest))
		}
	}

	@withRetry()
	async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
		await this.waitIfNeeded()
		const stream = await this.client.chat.stream({
			model: this.getModel().id,
			// max_completion_tokens: this.getModel().info.maxTokens,
			temperature: 0,
			messages: [{ role: "system", content: systemPrompt }, ...convertToMistralMessages(messages)],
			stream: true,
		})

		for await (const chunk of stream) {
			const delta = chunk.data.choices[0]?.delta
			if (delta?.content) {
				let content: string = ""
				if (typeof delta.content === "string") {
					content = delta.content
				} else if (Array.isArray(delta.content)) {
					content = delta.content.map((c) => (c.type === "text" ? c.text : "")).join("")
				}
				yield {
					type: "text",
					text: content,
				}
			}

			if (chunk.data.usage) {
				yield {
					type: "usage",
					inputTokens: chunk.data.usage.promptTokens || 0,
					outputTokens: chunk.data.usage.completionTokens || 0,
				}
			}
		}
	}

	getModel(): { id: MistralModelId; info: ModelInfo } {
		const modelId = this.options.apiModelId
		if (modelId && modelId in mistralModels) {
			const id = modelId as MistralModelId
			return { id, info: mistralModels[id] }
		}
		return {
			id: mistralDefaultModelId,
			info: mistralModels[mistralDefaultModelId],
		}
	}
}
