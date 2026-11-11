import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AssignPlanDto,
  CreateUserDto,
  UpdateProfileDto,
  UpdateUserDto,
} from '../dtos/userDTO';
import { IUsersRepository, SafeUser } from '../repositories/IUsers-repository';
import { compare, hash } from 'bcryptjs';
import { User } from '@prisma/client';
import { ITokenRepository } from '@modules/auth/repositories/ITokens-repository';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: IUsersRepository,
    private readonly tokenRepository: ITokenRepository,
  ) {}

  async create(
    createUserDto: CreateUserDto,
    companyId: string,
  ): Promise<SafeUser> {
    const username = createUserDto.username.trim();
    // findByUsername ignores case, so "Joao" and "joao" cannot both exist.
    const userExist = await this.usersRepository.findByUsername(username);
    if (userExist) throw new ConflictException('usuário já existente');
    const passwordHash = await hash(createUserDto.password, 8);
    return this.usersRepository.create({
      ...createUserDto,
      username,
      name: createUserDto.name.trim(),
      password: passwordHash,
      companyId,
    });
  }

  async findAll(companyId: string): Promise<SafeUser[]> {
    return this.usersRepository.findAllByCompany(companyId);
  }

  async findOne(id: string, companyId: string): Promise<SafeUser> {
    const user = await this.usersRepository.findById(id, companyId);
    if (!user) throw new NotFoundException('Usuário não existe');
    return user;
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    companyId: string,
  ): Promise<SafeUser> {
    const userExist = await this.usersRepository.findById(id, companyId);
    if (!userExist) throw new NotFoundException('Usuário não existe');

    const data: Partial<User> = {};
    const username = updateUserDto.username?.trim();
    if (username && username !== userExist.username) {
      const taken = await this.usersRepository.findByUsername(username);
      if (taken && taken.id !== id)
        throw new ConflictException('usuário já existente');
      data.username = username;
    }
    if (updateUserDto.name?.trim()) data.name = updateUserDto.name.trim();
    if (updateUserDto.password)
      data.password = await hash(updateUserDto.password, 8);

    const user = await this.usersRepository.update(id, data);
    if (data.password) await this.tokenRepository.deleteByUserId(id);
    return user;
  }

  async setPayment(id: string, companyId: string): Promise<SafeUser> {
    const userExist = await this.usersRepository.findById(id, companyId);
    if (!userExist) throw new NotFoundException('Usuário não existe');
    return this.usersRepository.update(id, { lastPayment: new Date() });
  }

  async remove(id: string, companyId: string): Promise<SafeUser> {
    const userExist = await this.usersRepository.findById(id, companyId);
    if (!userExist) throw new NotFoundException('Usuário não existe');
    const user = await this.usersRepository.softDelete(id);
    await this.tokenRepository.deleteByUserId(id);
    return user;
  }

  async freeze(id: string, companyId: string): Promise<SafeUser> {
    const userExist = await this.usersRepository.findById(id, companyId);
    if (!userExist) throw new NotFoundException('Usuário não existe');
    const user = await this.usersRepository.setFrozen(id, true);
    await this.tokenRepository.deleteByUserId(id);
    return user;
  }

  async unfreeze(id: string, companyId: string): Promise<SafeUser> {
    const userExist = await this.usersRepository.findById(id, companyId);
    if (!userExist) throw new NotFoundException('Usuário não existe');
    return this.usersRepository.setFrozen(id, false);
  }

  /** Plans are not scoped by company in the schema, so the plan itself is not checked against `companyId`. */
  async assignPlan(
    id: string,
    dto: AssignPlanDto,
    companyId: string,
  ): Promise<SafeUser> {
    const userExist = await this.usersRepository.findById(id, companyId);
    if (!userExist) throw new NotFoundException('Usuário não existe');
    return this.usersRepository.assignPlan(id, dto.planId ?? null);
  }

  async getMe(id: string): Promise<SafeUser> {
    const user = await this.usersRepository.findById(id);
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user;
  }

  async updateMyProfile(id: string, dto: UpdateProfileDto): Promise<SafeUser> {
    const user = await this.usersRepository.findByIdWithPassword(id);
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const data: Partial<User> = {};
    if (dto.newPassword) {
      if (!dto.currentPassword)
        throw new BadRequestException('Informe a senha atual para alterá-la');
      const matches = await compare(dto.currentPassword, user.password);
      if (!matches) throw new BadRequestException('Senha atual incorreta');
      data.password = await hash(dto.newPassword, 8);
    }
    if (dto.cpf !== undefined) data.cpf = dto.cpf;
    if (dto.email !== undefined) data.email = dto.email;

    const updated = await this.usersRepository.update(id, data);
    if (data.password) await this.tokenRepository.deleteByUserId(id);
    return updated;
  }
}
