export interface McpEnvVar {
  name: string
  isSecret: boolean
}

export interface McpTool {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}

export interface McpServerData {
  name: string
  type: 'local' | 'remote'
  command?: string
  args?: string[]
  url?: string
  envVars: McpEnvVar[]
  toolCount?: number
  tools: McpTool[]
  connectionTime?: number
  enabled: boolean
}
