export interface SmsMessage {
  mobile: string;
  text: string;
}

export interface SmsProvider {
  send(message: SmsMessage): Promise<void>;
}
