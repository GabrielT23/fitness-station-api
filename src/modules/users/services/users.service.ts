import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto, UpdateUserDto } from '../dtos/userDTO';
import { IUsersRepository } from '../repositories/IUsers-repository';
import { hash } from 'bcryptjs';
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

  async remove(id: string): Promise<void> {
    const userExist = await this.usersRepository.findById(id);
    if (!userExist) throw new NotFoundException('Usuário não existe');
    await this.usersRepository.deleteById(id);
  }
}
