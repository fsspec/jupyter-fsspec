import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { LogConfig, LogLevel, Logger } from './logger';

export const loggerSettingsSchema = {
  LogLevel: {
    type: 'string',
    title: 'Log Level',
    description: 'Set the verbosity of logging',
    enum: ['none', 'error', 'warn', 'info', 'debug'],
    default: 'info'
  }
};

export async function initializeLogger(
  settingRegistry: ISettingRegistry | null
): Promise<void> {
  const logger = Logger.getLogger('LoggerSettings');

  if (!settingRegistry) {
    logger.warn('Settings registry not available, using default log level');
    return;
  }

  try {
    const settings = await settingRegistry.load('jupyterFsspec:plugin');

    const composite = settings.composite as any;
    const logLevelSetting = composite?.logLevel || 'info';

    if (!composite?.logLevel) {
      await settings.set('logLevel', logLevelSetting);
    }

    updateLogLevel(logLevelSetting);

    settings.changed.connect(() => {
      const newLevel = settings.composite.logLevel as string;
      if (newLevel) {
        updateLogLevel(newLevel);
      }
    });
  } catch (error) {
    logger.error('Failed to initialize logger settings', error);
    LogConfig.setLevel(LogLevel.INFO);
  }
}

function updateLogLevel(logLevelSetting: string): void {
  const logger = Logger.getLogger('LoggerSettings');

  let logLevel: LogLevel;
  switch (logLevelSetting) {
    case 'none':
      logLevel = LogLevel.NONE;
      break;
    case 'error':
      logLevel = LogLevel.ERROR;
      break;
    case 'warn':
      logLevel = LogLevel.WARN;
      break;
    case 'info':
      logLevel = LogLevel.INFO;
      break;
    case 'debug':
      logLevel = LogLevel.DEBUG;
      break;
    default:
      logLevel = LogLevel.INFO;
  }

  LogConfig.setLevel(logLevel);
  logger.info(`Log level set to: ${logLevelSetting.toUpperCase()}`);
}
