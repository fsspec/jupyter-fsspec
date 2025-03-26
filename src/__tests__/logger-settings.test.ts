import { LogConfig, LogLevel, Logger } from '../logger';
import { initializeLogger } from '../loggerSettings';

describe('Logger Settings Integration', () => {
  const originalConsole = {
    debug: console.debug,
    info: console.info,
    warn: console.warn,
    error: console.error
  };

  let settingsRegistry: any;
  let settingsChangedCallback: () => void;
  let compositeSettings: any;
  let setMock: jest.Mock;

  beforeEach(() => {
    LogConfig.setLevel(LogLevel.INFO);

    console.debug = jest.fn();
    console.info = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();

    compositeSettings = { logLevel: 'info' };

    setMock = jest.fn().mockImplementation((key, value) => {
      compositeSettings[key] = value;
      return Promise.resolve();
    });

    settingsRegistry = {
      load: jest.fn().mockImplementation(() => ({
        composite: compositeSettings,
        set: setMock,

        changed: {
          connect: jest.fn().mockImplementation(callback => {
            settingsChangedCallback = callback;
            return { disconnect: jest.fn() };
          })
        }
      }))
    };
  });

  afterEach(() => {
    console.debug = originalConsole.debug;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  });

  test('initialize logger with settings from registry', async () => {
    compositeSettings.logLevel = 'debug';

    await initializeLogger(settingsRegistry);

    const logger = Logger.getLogger('TestContext');
    logger.debug('Debug message');

    expect(console.debug).toHaveBeenCalled();
  });

  test('responds to settings changes', async () => {
    await initializeLogger(settingsRegistry);

    const logger = Logger.getLogger('TestContext');

    logger.debug('Debug message 1');
    expect(console.debug).not.toHaveBeenCalled();

    compositeSettings.logLevel = 'debug';
    settingsChangedCallback();

    logger.debug('Debug message 2');
    expect(console.debug).toHaveBeenCalled();
  });

  test('sets default value if missing', async () => {
    delete compositeSettings.logLevel;

    await initializeLogger(settingsRegistry);

    expect(setMock).toHaveBeenCalledWith('logLevel', 'info');

    const logger = Logger.getLogger('Test Context');
    logger.info('Info message');
    logger.debug('Debug message');

    expect(console.info).toHaveBeenCalled();
    expect(console.debug).not.toHaveBeenCalled();
  });

  test('handles null settings registry', async () => {
    await initializeLogger(null);

    expect(console.warn).toHaveBeenCalled();

    const logger = Logger.getLogger('Test Context');
    logger.info('Info message');
    logger.debug('Debug message');

    expect(console.info).toHaveBeenCalled();
    expect(console.debug).not.toHaveBeenCalled();
  });

  test('handles load error in settings registry', async () => {
    settingsRegistry.load = jest.fn().mockImplementation(() => {
      throw new Error('Failed to load settings');
    });

    await expect(initializeLogger(settingsRegistry)).resolves.not.toThrow();

    expect(console.error).toHaveBeenCalled();

    const logger = Logger.getLogger('TestContext');
    logger.info('Info message');
    logger.debug('Debug message');

    expect(console.info).toHaveBeenCalled();
    expect(console.debug).not.toHaveBeenCalled();
  });

  test('handles invalid log level in settings', async () => {
    compositeSettings.logLevel = 'invalid_level';

    await initializeLogger(settingsRegistry);

    const logger = Logger.getLogger('TestContext');
    logger.info('Info message');
    logger.debug('Debug message');

    expect(console.info).toHaveBeenCalled();
    expect(console.debug).not.toHaveBeenCalled();
  });

  test('handles complete failure in settings registry', async () => {
    const brokenRegistry = {
      load: jest.fn().mockRejectedValue(new Error('Complete failure'))
    };

    await initializeLogger(brokenRegistry as any);

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to initialize logger settings'),
      expect.any(Error)
    );

    const logger = Logger.getLogger('TestContext');
    logger.info('Info message');
    logger.debug('Debug message');

    expect(console.info).toHaveBeenCalled();
    expect(console.debug).not.toHaveBeenCalled();
  });

  test('correctly maps all possible log level settings', async () => {
    const levels = ['none', 'error', 'warn', 'info', 'debug'];

    for (const level of levels) {
      jest.clearAllMocks();

      compositeSettings.logLevel = level;

      await initializeLogger(settingsRegistry);

      const logger = Logger.getLogger('LevelTest');

      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warn message');
      logger.error('Error message');

      switch (level) {
        case 'none':
          expect(console.debug).not.toHaveBeenCalled();
          expect(console.info).not.toHaveBeenCalled();
          expect(console.warn).not.toHaveBeenCalled();
          expect(console.error).not.toHaveBeenCalled();
          break;
        case 'error':
          expect(console.debug).not.toHaveBeenCalled();
          expect(console.info).not.toHaveBeenCalled();
          expect(console.warn).not.toHaveBeenCalled();
          expect(console.error).toHaveBeenCalled();
          break;
        case 'warn':
          expect(console.debug).not.toHaveBeenCalled();
          expect(console.info).not.toHaveBeenCalled();
          expect(console.warn).toHaveBeenCalled();
          expect(console.error).toHaveBeenCalled();
          break;
        case 'info':
          expect(console.debug).not.toHaveBeenCalled();
          expect(console.info).toHaveBeenCalled();
          expect(console.warn).toHaveBeenCalled();
          expect(console.error).toHaveBeenCalled();
          break;
        case 'debug':
          expect(console.debug).toHaveBeenCalled();
          expect(console.info).toHaveBeenCalled();
          expect(console.warn).toHaveBeenCalled();
          expect(console.error).toHaveBeenCalled();
          break;
      }
    }
  });
});
