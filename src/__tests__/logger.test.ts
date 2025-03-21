import { Logger, LogLevel, LogConfig } from '../logger';

describe('Logger', () => {
  const originalConsole = {
    debug: console.debug,
    info: console.info,
    warn: console.warn,
    error: console.error
  };

  beforeEach(() => {
    console.debug = jest.fn();
    console.info = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  });

  afterEach(() => {
    console.debug = originalConsole.debug;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  });

  test('creates logger with context', () => {
    const logger = Logger.getLogger('TestContext');
    expect(logger).toBeInstanceOf(Logger);
  });

  test('respects log level settings', () => {
    LogConfig.setLevel(LogLevel.WARN);

    const logger = Logger.getLogger('TestContext');

    // These should not log anything
    logger.debug('Debug message');
    logger.info('Info message');

    // These should log
    logger.warn('Warning message');
    logger.error('Error message');

    expect(console.debug).not.toHaveBeenCalled();
    expect(console.info).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      '[WARN][TestContext] Warning message'
    );
    expect(console.error).toHaveBeenCalledWith(
      '[ERROR][TestContext] Error message'
    );
  });

  test('includes additional arguments in log', () => {
    LogConfig.setLevel(LogLevel.DEBUG);
    const logger = Logger.getLogger('TestContext');

    const testObject = { key: 'value' };
    logger.debug('Debug with object', testObject);

    expect(console.debug).toHaveBeenCalledWith(
      '[DEBUG][TestContext] Debug with object',
      testObject
    );
  });

  test('changes log level during runtime', () => {
    const logger = Logger.getLogger('TestContext');

    LogConfig.setLevel(LogLevel.ERROR);

    logger.warn('Warning should not appear');
    logger.error('Error should appear');

    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledTimes(1);

    LogConfig.setLevel(LogLevel.INFO);

    logger.info('Info should now appear');
    logger.debug('Debug should still not appear');

    expect(console.info).toHaveBeenCalledTimes(1);
    expect(console.debug).not.toHaveBeenCalled();
  });

  test('works with NONE log level', () => {
    LogConfig.setLevel(LogLevel.NONE);
    const logger = Logger.getLogger('TestContext');

    logger.debug('Should not log');
    logger.info('Should not log');
    logger.warn('Should not log');
    logger.error('Should not log');

    expect(console.debug).not.toHaveBeenCalled();
    expect(console.info).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });
});
