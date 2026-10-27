/**
 * FIREGUARD AI - Web Bluetooth & Web Serial Connection Service
 * Connects directly to the ESP32 Safety Robot over BLE (Nordic UART) or Bluetooth Serial (RFCOMM)
 */

import { TelemetryData } from '../types';

// Primary Custom BLE UUIDs specified for ESP32 Safety Robot
export const ROBOT_BLE_SERVICE = '12345678-1234-1234-1234-1234567890ab';
export const ROBOT_BLE_TX = '12345678-1234-1234-1234-1234567890ac'; // ESP32 -> Website Notifications

// Standard Nordic UART fallback UUIDs
export const NORDIC_UART_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
export const NORDIC_UART_RX = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
export const NORDIC_UART_TX = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

export type BluetoothConnectionType = 'ble' | 'serial' | 'none';

class BluetoothController {
  private device: any = null;
  private server: any = null;
  private rxCharacteristic: any = null;
  private txCharacteristic: any = null;
  
  private serialPort: any = null;
  private serialReader: any = null;
  private serialWriter: any = null;

  private connectionType: BluetoothConnectionType = 'none';
  private connected: boolean = false;
  private deviceName: string = '';
  private rxBuffer: string = '';

  private onDataCallback: ((data: Partial<TelemetryData>) => void) | null = null;
  private onStatusCallback: ((connected: boolean, name: string, type: BluetoothConnectionType, error?: string) => void) | null = null;
  private onLogCallback: ((msg: string) => void) | null = null;

  public isSupported(): { ble: boolean; serial: boolean } {
    return {
      ble: typeof navigator !== 'undefined' && 'bluetooth' in navigator,
      serial: typeof navigator !== 'undefined' && 'serial' in navigator,
    };
  }

  public setCallbacks(
    onData: (data: Partial<TelemetryData>) => void,
    onStatus: (connected: boolean, name: string, type: BluetoothConnectionType, error?: string) => void,
    onLog: (msg: string) => void
  ) {
    this.onDataCallback = onData;
    this.onStatusCallback = onStatus;
    this.onLogCallback = onLog;
  }

  private log(msg: string) {
    if (this.onLogCallback) {
      this.onLogCallback(`[${new Date().toLocaleTimeString()}] ${msg}`);
    }
  }

  /**
   * Connect via Web Bluetooth searching by device name (or scanning all devices)
   */
  public async connectBLE(targetName: string = 'ESP32_Safety_Robot', scanAll: boolean = false): Promise<boolean> {
    if (typeof navigator === 'undefined' || !('bluetooth' in navigator)) {
      throw new Error('متصفحك لا يدعم Web Bluetooth. يرجى استخدام Google Chrome أو Microsoft Edge على الكمبيوتر أو الأندرويد.');
    }

    // Check if running in an iframe
    const isIframe = typeof window !== 'undefined' && window.self !== window.top;

    try {
      const cleanName = targetName.trim() || 'ESP32_Safety_Robot';
      const requestOptions: any = {
        optionalServices: [ROBOT_BLE_SERVICE.toLowerCase(), NORDIC_UART_SERVICE.toLowerCase()]
      };

      if (scanAll) {
        this.log('Scanning all nearby Bluetooth devices (acceptAllDevices)...');
        requestOptions.acceptAllDevices = true;
      } else {
        this.log(`Searching for Bluetooth device: "${cleanName}"...`);
        // Include exact name and prefixes so truncated advertising names are still discovered
        requestOptions.filters = [
          { name: cleanName },
          { namePrefix: cleanName },
          { namePrefix: 'ESP32' }
        ];
      }
      
      this.device = await (navigator as any).bluetooth.requestDevice(requestOptions);

      this.deviceName = this.device.name || cleanName;
      this.log(`Device chosen: "${this.deviceName}". Connecting to GATT Server...`);

      this.device.addEventListener('gattserverdisconnected', this.handleDisconnection.bind(this));

      this.server = await this.device.gatt.connect();
      this.log('GATT Connected! Discovering BLE Services...');

      let service: any = null;

      try {
        service = await this.server.getPrimaryService(ROBOT_BLE_SERVICE.toLowerCase());
        this.txCharacteristic = await service.getCharacteristic(ROBOT_BLE_TX.toLowerCase());
        this.log(`Connected to Robot Service (${ROBOT_BLE_SERVICE})!`);
      } catch (srvErr) {
        this.log('Custom UUID service not detected, trying Nordic UART service...');
        service = await this.server.getPrimaryService(NORDIC_UART_SERVICE.toLowerCase());
        this.txCharacteristic = await service.getCharacteristic(NORDIC_UART_TX.toLowerCase());
        try {
          this.rxCharacteristic = await service.getCharacteristic(NORDIC_UART_RX.toLowerCase());
        } catch {}
      }

      await this.txCharacteristic.startNotifications();
      this.txCharacteristic.addEventListener('characteristicvaluechanged', (event: any) => {
        const value = event.target.value;
        const decoder = new TextDecoder('utf-8');
        const chunk = decoder.decode(value);
        this.handleIncomingChunk(chunk);
      });

      this.connected = true;
      this.connectionType = 'ble';
      this.log(`Connected to ${this.deviceName}! Receiving sensor notifications.`);
      
      if (this.onStatusCallback) {
        this.onStatusCallback(true, this.deviceName, 'ble');
      }

      return true;
    } catch (err: any) {
      let friendlyError = err.message || 'حدث خطأ أثناء الاتصال بالبلوتوث';

      if (err.name === 'SecurityError' || friendlyError.includes('permissions policy') || isIframe) {
        friendlyError = 'IFRAME_BLOCKED: متصفح كروم يقيد البلوتوث داخل شاشة المعاينة (iframe). اضغط على زر "فتح في نافذة مستقلة" بالأعلى ليعمل البلوتوث بحرية.';
      } else if (err.name === 'NotFoundError' || friendlyError.includes('User cancelled')) {
        friendlyError = `لم يتم العثور على جهاز باسم "${targetName}" أو تم إغلاق النافذة. تأكد من تشغيل الـ ESP32 أو اضغط "SCAN ALL".`;
      }

      this.log(`BLE Error: ${friendlyError}`);
      if (this.onStatusCallback) {
        this.onStatusCallback(false, '', 'none', friendlyError);
      }
      throw new Error(friendlyError);
    }
  }

  /**
   * Connect via Web Serial (Bluetooth RFCOMM / COM port / Serial Monitor)
   */
  public async connectSerial(): Promise<boolean> {
    if (!('serial' in navigator)) {
      throw new Error('Web Serial is not supported in this browser. Please use Google Chrome or Edge.');
    }

    try {
      this.log('Prompting for Bluetooth / USB Serial COM port...');
      this.serialPort = await (navigator as any).serial.requestPort();
      await this.serialPort.open({ baudRate: 115200 });

      this.deviceName = 'ESP32 Serial / Bluetooth';
      this.connected = true;
      this.connectionType = 'serial';
      this.log('Serial port opened at 115200 baud.');

      if (this.onStatusCallback) {
        this.onStatusCallback(true, this.deviceName, 'serial');
      }

      this.startSerialReadLoop();
      return true;
    } catch (err: any) {
      this.log(`Serial connection error: ${err.message}`);
      if (this.onStatusCallback) {
        this.onStatusCallback(false, '', 'none', err.message);
      }
      throw err;
    }
  }

  private async startSerialReadLoop() {
    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = this.serialPort.readable.pipeTo(textDecoder.writable);
    const reader = textDecoder.readable.getReader();
    this.serialReader = reader;

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          this.handleIncomingChunk(value);
        }
      }
    } catch (error) {
      this.log(`Serial reader error: ${error}`);
    } finally {
      reader.releaseLock();
    }
  }

  private handleIncomingChunk(chunk: string) {
    this.rxBuffer += chunk;
    const lines = this.rxBuffer.split('\n');
    this.rxBuffer = lines.pop() || ''; // Keep remainder

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      // 1. Try parsing structured JSON
      if (line.startsWith('{') && line.endsWith('}')) {
        try {
          const parsed = JSON.parse(line);
          this.parseAndEmitTelemetry(parsed);
          continue;
        } catch {
          // not valid JSON, continue with text parsing
        }
      }

      // 2. Parse sensor log format matching user's sketch
      this.parseLineFormattedTelemetry(line);
    }
  }

  private parseAndEmitTelemetry(obj: any) {
    const rawAdc = obj.mq7_adc !== undefined ? Number(obj.mq7_adc) : (obj.mq7Value ? Number(obj.mq7Value) : 0);
    const coHigh = Boolean(obj.mq7_high || rawAdc >= 1900);
    const flameDetected = Boolean(obj.flame ?? obj.fireDetected ?? obj.flame_detected);
    const soundDetected = Boolean(obj.sound ?? obj.soundDetected);
    
    const tempVal = obj.temperature !== null && obj.temperature !== undefined ? Number(obj.temperature) : 24.5;
    const humVal = obj.humidity !== null && obj.humidity !== undefined ? Number(obj.humidity) : 48.0;

    const latVal = obj.latitude !== null && obj.latitude !== undefined ? Number(obj.latitude) : (obj.lat ?? 37.774900);
    const lngVal = obj.longitude !== null && obj.longitude !== undefined ? Number(obj.longitude) : (obj.lng ?? -122.419400);
    const satsVal = obj.satellites !== null && obj.satellites !== undefined ? Number(obj.satellites) : (obj.sats ?? 0);

    const isCritical = flameDetected || coHigh;

    const mapped: Partial<TelemetryData> = {
      timestamp: new Date().toISOString(),
      deviceId: this.deviceName || 'ESP32_Safety_Robot',
      // MQ-7 reading is raw ADC, not calibrated ppm; we store rawAdc and show ppm estimate
      mq7_co_ppm: rawAdc > 0 ? Number((rawAdc / 40.0).toFixed(1)) : 15.0,
      flame_raw: rawAdc,
      flame_detected: flameDetected,
      sound_db: soundDetected ? 88.0 : 42.0,
      temperature: Number(tempVal.toFixed(1)),
      humidity: Number(humVal.toFixed(1)),
      gps: {
        lat: latVal,
        lng: lngVal,
        satellites: satsVal,
        altitude: 15.0,
      },
      status: isCritical ? 'CRITICAL' : 'NORMAL'
    };

    if (this.onDataCallback) {
      this.onDataCallback(mapped);
    }
  }

  private parseLineFormattedTelemetry(line: string) {
    // Detect key lines from user's Arduino code:
    // "MQ-7 ADC: 1450"
    // "Flame: DETECTED"
    // "Sound event: DETECTED"
    // "Temperature: 26.50 C"
    // "Humidity: 48.20 %"
    // "Latitude: 37.774900"
    // "Longitude: -122.419400"
    
    if (line.includes('MQ-7 ADC:')) {
      const parts = line.split(':');
      const adc = parseInt(parts[1]?.trim() || '0', 10);
      if (this.onDataCallback) {
        this.onDataCallback({
          mq7_co_ppm: Number((adc / 40).toFixed(1)), // rough estimate
          flame_raw: adc,
        });
      }
    } else if (line.includes('Flame:')) {
      const isDetected = line.includes('DETECTED') && !line.includes('NOT DETECTED');
      if (this.onDataCallback) {
        this.onDataCallback({ flame_detected: isDetected });
      }
    } else if (line.includes('Sound event:')) {
      const isDetected = line.includes('DETECTED') && !line.includes('NONE');
      if (this.onDataCallback) {
        this.onDataCallback({ sound_db: isDetected ? 88.0 : 42.0 });
      }
    } else if (line.includes('Temperature:')) {
      const match = line.match(/Temperature:\s*([\d.]+)/);
      if (match && this.onDataCallback) {
        this.onDataCallback({ temperature: parseFloat(match[1]) });
      }
    } else if (line.includes('Humidity:')) {
      const match = line.match(/Humidity:\s*([\d.]+)/);
      if (match && this.onDataCallback) {
        this.onDataCallback({ humidity: parseFloat(match[1]) });
      }
    } else if (line.includes('Latitude:')) {
      const match = line.match(/Latitude:\s*([\d.-]+)/);
      if (match && this.onDataCallback) {
        this.onDataCallback({ gps: { lat: parseFloat(match[1]), lng: -122.4194 } });
      }
    } else if (line.includes('Longitude:')) {
      const match = line.match(/Longitude:\s*([\d.-]+)/);
      if (match && this.onDataCallback) {
        this.onDataCallback({ gps: { lat: 37.7749, lng: parseFloat(match[1]) } });
      }
    }
  }

  /**
   * Send single movement command character ('F', 'B', 'L', 'R', 'S')
   */
  public async sendCommand(cmd: string): Promise<boolean> {
    if (!this.connected) return false;
    const command = cmd.toUpperCase();

    try {
      if (this.connectionType === 'ble' && this.rxCharacteristic) {
        const encoder = new TextEncoder();
        await this.rxCharacteristic.writeValue(encoder.encode(command + '\n'));
        this.log(`Sent BLE command: '${command}'`);
        return true;
      } else if (this.connectionType === 'serial' && this.serialPort) {
        const writer = this.serialPort.writable.getWriter();
        const encoder = new TextEncoder();
        await writer.write(encoder.encode(command + '\n'));
        writer.releaseLock();
        this.log(`Sent Serial command: '${command}'`);
        return true;
      }
    } catch (err: any) {
      this.log(`Failed to send command '${command}': ${err.message}`);
      return false;
    }
    return false;
  }

  private handleDisconnection() {
    this.connected = false;
    this.connectionType = 'none';
    this.log(`Bluetooth device disconnected: ${this.deviceName}`);
    if (this.onStatusCallback) {
      this.onStatusCallback(false, this.deviceName, 'none');
    }
  }

  public async disconnect() {
    try {
      // Send STOP command before disconnecting
      await this.sendCommand('S');
    } catch {}

    if (this.device && this.device.gatt && this.device.gatt.connected) {
      this.device.gatt.disconnect();
    }

    if (this.serialReader) {
      try {
        await this.serialReader.cancel();
      } catch {}
    }

    if (this.serialPort) {
      try {
        await this.serialPort.close();
      } catch {}
    }

    this.connected = false;
    this.connectionType = 'none';
    this.handleDisconnection();
  }

  public isConnected(): boolean {
    return this.connected;
  }

  public getConnectionType(): BluetoothConnectionType {
    return this.connectionType;
  }

  public getDeviceName(): string {
    return this.deviceName;
  }
}

export const bluetoothService = new BluetoothController();
