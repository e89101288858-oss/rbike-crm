import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { json, urlencoded } from 'express'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.use(json({ limit: '25mb' }))
  app.use(urlencoded({ extended: true, limit: '25mb' }))

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )

  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',').map((v) => v.trim()) ?? true,
    credentials: true,
  })

  const port = Number(process.env.PORT || 3001)
  await app.listen(port, '0.0.0.0')
  console.log(`API listening on http://0.0.0.0:${port}`)
}
bootstrap()
