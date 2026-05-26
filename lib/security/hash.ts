import crypto from 'crypto'

export async function sha256Buffer(buffer: Buffer): Promise<string> {
  return crypto
    .createHash('sha256')
    .update(buffer)
    .digest('hex')
}