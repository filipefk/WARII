// Contrato de comunicação entre servidor e front (eventos do Socket.IO e DTOs da API REST).

export interface ServerToClientEvents {
  boasVindas: (mensagem: string) => void;
}

export interface ClientToServerEvents {}
