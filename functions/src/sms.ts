import twilio from 'twilio';

export interface SMSMessage {
  to: string;
  body: string;
}

export interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface SMSProvider {
  sendSMS(msg: SMSMessage): Promise<SMSResult>;
}

/**
 * Twilio SMS Provider
 * Reads credentials from environment variables / Firebase secrets:
 * - TWILIO_ACCOUNT_SID
 * - TWILIO_AUTH_TOKEN
 * - TWILIO_PHONE_NUMBER
 */
export class TwilioSMSProvider implements SMSProvider {
  private client: twilio.Twilio | null = null;
  private fromNumber: string | null = null;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER || null;

    if (accountSid && authToken && this.fromNumber) {
      this.client = twilio(accountSid, authToken);
    }
  }

  async sendSMS(msg: SMSMessage): Promise<SMSResult> {
    if (!this.client || !this.fromNumber) {
      const errMsg = 'Twilio credentials not configured in environment (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER).';
      console.warn(`[SMS Provider] Mock Dispatch to ${msg.to}: "${msg.body}" - Reason: ${errMsg}`);
      
      // If mock log is enabled or in emulator, report mock success so local runs can be simulated
      if (process.env.VITE_MOCK_SMS_LOG === 'true' || process.env.FUNCTIONS_EMULATOR === 'true') {
        return {
          success: true,
          messageId: `mock_${Date.now()}`
        };
      }
      return {
        success: false,
        error: errMsg
      };
    }

    try {
      const response = await this.client.messages.create({
        to: msg.to,
        from: this.fromNumber,
        body: msg.body
      });
      return {
        success: true,
        messageId: response.sid
      };
    } catch (err: any) {
      console.error(`[Twilio Error] Failed to send SMS to ${msg.to}:`, err);
      return {
        success: false,
        error: err.message || 'Twilio send failure'
      };
    }
  }
}

/**
 * TODO: Indian SMS Provider implementation (MSG91 / Fast2SMS)
 * -------------------------------------------------------------
 * For production deployment targeting India, Telecom Regulatory Authority of India (TRAI)
 * mandates DLT (Distributed Ledger Technology) registration:
 * 
 * 1. MSG91 Implementation:
 *    - API Endpoint: https://control.msg91.com/api/v5/flow/
 *    - Headers: authkey (secret), Content-Type: application/json
 *    - Payload: {
 *        template_id: "<DLT_APPROVED_TEMPLATE_ID>",
 *        sender: "<6_CHAR_APPROVED_SENDER_ID>", // e.g. "SRKSHA"
 *        short_url: "0",
 *        recipients: [{ mobiles: "91" + phone, var1: name, var2: locationUrl, var3: alertId }]
 *      }
 * 
 * 2. Fast2SMS Implementation:
 *    - API Endpoint: https://www.fast2sms.com/dev/bulkV2
 *    - Headers: authorization: "<FAST2SMS_API_KEY>"
 *    - Payload: {
 *        route: "dlt",
 *        sender_id: "<DLT_SENDER_ID>",
 *        message: "<DLT_TEMPLATE_ID>",
 *        variables_values: `${name}|${locationUrl}|${alertId}`,
 *        flash: 0,
 *        numbers: phone
 *      }
 */
export class IndianSMSProvider implements SMSProvider {
  async sendSMS(msg: SMSMessage): Promise<SMSResult> {
    // Placeholder until MSG91 / Fast2SMS credentials and approved DLT template IDs are provided
    console.info(`[IndianSMSProvider TODO] SMS dispatch requested for ${msg.to}: ${msg.body}`);
    return {
      success: false,
      error: 'Indian SMS Provider (MSG91/Fast2SMS) not yet initialized. Configure DLT template IDs.'
    };
  }
}

let defaultProvider: SMSProvider | null = null;

export const getSMSProvider = (): SMSProvider => {
  if (!defaultProvider) {
    defaultProvider = new TwilioSMSProvider();
  }
  return defaultProvider;
};

export const setSMSProvider = (provider: SMSProvider): void => {
  defaultProvider = provider;
};
