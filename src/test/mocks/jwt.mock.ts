export const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock-token'),
  verify: jest.fn().mockReturnValue({ id: '1', username: 'test', role: 'admin' }),
  verifyAsync: jest.fn().mockResolvedValue({ id: '1', username: 'test', role: 'admin' }),
  decode: jest.fn().mockReturnValue({ id: '1', username: 'test', role: 'admin', companyId: '1' }),
};