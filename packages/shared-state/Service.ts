export abstract class SharedStateSercvice<T extends Record<string, unknown>> {
  state: T;
  ports: SharedStatePort<T>[] = [];
  timestamp: number = new Date().getTime();

  constructor(def: T) {
    this.state = def;
  }

  broadcastUpdate(data: ChangeData) {
    this.ports.forEach((v) => v.updateState(data));
  }

  update(payload: ChangeData['payload'], timestamp?: number) {
    if (timestamp && timestamp !== this.timestamp) {
      return null;
    }

    const from = this.timestamp;
    const to = new Date().getTime();
    payload.forEach(({ key, value }) => {
      this.state[key as keyof T] = value;
    });
    this.timestamp = to;
    this.broadcastUpdate({ from, to, payload });
    return to;
  }

  bind(port: SharedStatePort<T>) {
    if (port.binding) {
      port.binding.onClose();
    }
    this.ports = this.ports.filter((v) => v !== port).concat([port]);
    port.binding = {
      onClose: () => this.unbind(port),
      onCheckTimestamp: () => this.timestamp,
      onEmitUpdate: (payload, timestamp) => this.update(payload, timestamp),
      onRequsetReload: () => ({ state: this.state, timestamp: this.timestamp }),
    };
  }
  unbind(port: SharedStatePort<T>) {
    this.ports = this.ports.filter((v) => v !== port);
  }
}

export interface SharedStatePort<T extends Record<string, unknown>> {
  binding?: {
    onClose: () => void;
    onEmitUpdate: (
      payload: ChangeData['payload'],
      timestamp?: number
    ) => number | null;
    onRequsetReload: () => { state: T; timestamp: number };
    onCheckTimestamp: () => number;
  };

  updateState(data: ChangeData): void;
}

export interface ChangeData {
  from: number;
  to: number;
  payload: { key: string; value: any }[];
}

export class SharedStateClient<T extends Record<string, unknown>> {
  data: T;
  timestamp: number = new Date().getTime();
  constructor(def: T) {
    this.data = def;
  }
}
