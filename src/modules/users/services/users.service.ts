import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AssignPlanDto, CreateUserDto, UpdateProfileDto, UpdateUserDto } from '../dtos/userDTO';
import { IUsersRepository } from '../repositories/IUsers-repository';
import { compare, hash } from 'bcryptjs';
import { User } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: IUsersRepository,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<Omit<CreateUserDto, 'password'>> {
    const userExist = await this.usersRepository.findByUsername(
      createUserDto.username,
    );
    if (userExist) throw new ConflictException('usuário já existente');
    const passwordHash = await hash(createUserDto.password, 8);
    createUserDto.password = passwordHash;
    let createUserDtoRest = createUserDto;
    let {password, ...user} = await this.usersRepository.create(createUserDtoRest);
    return {...user};
  }

  async findAll(): Promise<User[]> {
    const users = await this.usersRepository.findAll();
    return users;
  }

  async findOne(id: string): Promise<Omit<User, "password">> {
    const {password, ...user} = await this.usersRepository.findById(id);
    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<Omit<User, "password">> {
    const userExist = await this.usersRepository.findById(id);
    let passwordHash = null;
    if (updateUserDto.password) {
      passwordHash = await hash(updateUserDto.password, 8);
    }
    if (passwordHash) updateUserDto.password = passwordHash;
    if (!userExist) throw new NotFoundException('Usuário não existe');

    if(updateUserDto.password) userExist.password = updateUserDto.password;
    if(updateUserDto.username) userExist.username = updateUserDto.username;
    if(updateUserDto.name) userExist.name = updateUserDto.name;

    const {password, ...user} = await this.usersRepository.update(id, userExist);
    return user;
  }

  async setPayment(id: string): Promise<Omit<User, "password">> {
    const userExist = await this.usersRepository.findById(id);
    userExist.lastPayment = new Date();
    const {password, ...user} = await this.usersRepository.update(id, userExist);
    return user;
  }

  async remove(id: string): Promise<Omit<User, 'password'>> {
    const userExist = await this.usersRepository.findById(id);
    if (!userExist) throw new NotFoundException('Usuário não existe');
    const { password, ...user } = await this.usersRepository.softDelete(id);
    return user;
  }

  async freeze(id: string): Promise<Omit<User, 'password'>> {
    const userExist = await this.usersRepository.findById(id);
    if (!userExist) throw new NotFoundException('Usuário não existe');
    const { password, ...user } = await this.usersRepository.setFrozen(id, true);
    return user;
  }

  async unfreeze(id: string): Promise<Omit<User, 'password'>> {
    const userExist = await this.usersRepository.findById(id);
    if (!userExist) throw new NotFoundException('Usuário não existe');
    const { password, ...user } = await this.usersRepository.setFrozen(id, false);
    return user;
  }

  async assignPlan(id: string, dto: AssignPlanDto): Promise<Omit<User, 'password'>> {
    const userExist = await this.usersRepository.findById(id);
    if (!userExist) throw new NotFoundException('Usuário não existe');
    const { password, ...user } = await this.usersRepository.assignPlan(id, dto.planId ?? null);
    return user;
  }

  async getMe(id: string): Promise<Omit<User, 'password'>> {
    const user = await this.usersRepository.findById(id);
    if (!user) throw new NotFoundException('Usuário não encontrado');
    const { password, ...rest } = user;
    return rest;
  }

  async updateMyProfile(id: string, dto: UpdateProfileDto): Promise<Omit<User, 'password'>> {
    const user = await this.usersRepository.findById(id);
    if (!user) throw new NotFoundException('Usuário não encontrado');

    if (dto.newPassword) {
      if (!dto.currentPassword) throw new BadRequestException('Informe a senha atual para alterá-la');
      const matches = await compare(dto.currentPassword, user.password);
      if (!matches) throw new BadRequestException('Senha atual incorreta');
      (user as any).password = await hash(dto.newPassword, 8);
    }

    if (dto.cpf !== undefined) (user as any).cpf = dto.cpf;
    if (dto.email !== undefined) (user as any).email = dto.email;

    const { password, ...rest } = await this.usersRepository.update(id, user);
    return rest;
  }
}
