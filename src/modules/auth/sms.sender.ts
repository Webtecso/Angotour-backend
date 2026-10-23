/**
 * Ponto unico de envio de SMS. Em desenvolvimento nao envia nada (o codigo
 * aparece na consola do backend, ver OtpService). Quando houver fornecedor real
 * (Twilio, Africa's Talking, gateway das operadoras), so este ficheiro muda.
 */
export async function sendSms(phone: string, message: string): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Fornecedor de SMS nao configurado (ver src/modules/auth/sms.sender.ts).');
  }
  void phone;
  void message;
}
