import { Controller, Get } from '@nestjs/common';
import { readRuntimeVersionInfo } from './common/version.util';

@Controller()
export class AppController {
  @Get()
  getHello(): string {
    return 'Dr.X API is running';
  }

  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: readRuntimeVersionInfo(),
    };
  }

  @Get('version')
  getVersion() {
    return readRuntimeVersionInfo();
  }
}
