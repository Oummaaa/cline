import { ClineMessage } from "../../shared/ExtensionMessage"

export interface TaskVerificationResult {
	isComplete: boolean
	issues?: string[]
	nextTaskDetails?: {
		description: string
		priority: "high" | "medium" | "low"
	}
}

export class TaskPilot {
	private currentTask: string = ""
	private taskMessages: ClineMessage[]
	private verificationTasks: Map<string, TaskVerificationResult>

	constructor() {
		this.taskMessages = []
		this.verificationTasks = new Map()
	}

	/**
	 * Initialise une nouvelle tâche à surveiller
	 */
	initializeTask(taskDescription: string) {
		console.log("[TaskPilot] Initializing task:", taskDescription)
		this.currentTask = taskDescription
		this.taskMessages = []
	}

	/**
	 * Ajoute un message à l'historique de la tâche en cours
	 */
	addTaskMessage(message: ClineMessage) {
		console.log("[TaskPilot] Adding message:", message.type, message.say || message.ask)
		this.taskMessages.push(message)
	}

	/**
	 * Vérifie si la tâche actuelle est terminée et correctement réalisée
	 */
	async verifyTaskCompletion(): Promise<TaskVerificationResult> {
		console.log("[TaskPilot] Verifying task completion")
		console.log("[TaskPilot] Current messages:", this.taskMessages.length)

		// Analyse des messages de la tâche
		const completionMessages = this.taskMessages.filter((m) => m.say === "completion_result")
		const lastCompletionMessage = completionMessages[completionMessages.length - 1]

		if (!lastCompletionMessage) {
			console.log("[TaskPilot] No completion message found")
			return {
				isComplete: false,
				issues: ["La tâche n'a pas de message de complétion"],
			}
		}

		// Vérification des erreurs potentielles après le dernier message de complétion
		const lastCompletionIndex = this.taskMessages.indexOf(lastCompletionMessage)
		const errorsAfterCompletion = this.taskMessages.slice(lastCompletionIndex).filter((m) => m.say === "error")
		console.log("[TaskPilot] Found errors after completion:", errorsAfterCompletion.length)

		if (errorsAfterCompletion.length > 0) {
			console.log("[TaskPilot] Task has errors after completion")
			return {
				isComplete: false,
				issues: ["Des erreurs ont été détectées après le dernier message de complétion"],
				nextTaskDetails: {
					description: "Corriger les erreurs identifiées",
					priority: "high",
				},
			}
		}

		// Vérification des modifications de fichiers
		const fileEdits = this.taskMessages.filter(
			(m) => m.say === "tool" && (m.text?.includes("editedExistingFile") || m.text?.includes("newFileCreated")),
		)
		console.log("[TaskPilot] Found file edits:", fileEdits.length)

		// Si des fichiers ont été modifiés, créer une tâche de vérification
		if (fileEdits.length > 0) {
			console.log("[TaskPilot] Creating verification task for file edits")
			return {
				isComplete: true,
				nextTaskDetails: {
					description: "Vérifier les modifications de fichiers et leur cohérence",
					priority: "medium",
				},
			}
		}

		console.log("[TaskPilot] Task completed successfully")
		return {
			isComplete: true,
		}
	}

	/**
	 * Crée une nouvelle tâche de vérification basée sur le résultat
	 */
	createVerificationTask(result: TaskVerificationResult): string | null {
		console.log("[TaskPilot] Creating verification task", result)

		if (!result.nextTaskDetails) {
			console.log("[TaskPilot] No next task details, skipping verification task")
			return null
		}

		const taskId = `verify_${Date.now()}`
		this.verificationTasks.set(taskId, result)
		console.log("[TaskPilot] Created verification task:", taskId)

		return taskId
	}

	/**
	 * Récupère les détails d'une tâche de vérification
	 */
	getVerificationTask(taskId: string): TaskVerificationResult | undefined {
		console.log("[TaskPilot] Getting verification task:", taskId)
		const task = this.verificationTasks.get(taskId)
		console.log("[TaskPilot] Found task:", task)
		return task
	}
}
