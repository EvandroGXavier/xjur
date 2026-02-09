
import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateMovementDto } from './dto/create-movement.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';

@Controller('products')
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  create(@Body() createProductDto: CreateProductDto, @CurrentUser() user: CurrentUserData) {
    if (!user || !user.tenantId) throw new Error('User context invalid');
    return this.productsService.create(createProductDto, user.tenantId);
  }

  @Get()
  findAll(@CurrentUser() user: CurrentUserData) {
    if (!user || !user.tenantId) throw new Error('User context invalid');
    return this.productsService.findAll(user.tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    if (!user || !user.tenantId) throw new Error('User context invalid');
    return this.productsService.findOne(id, user.tenantId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProductDto: Partial<CreateProductDto>, @CurrentUser() user: CurrentUserData) {
    if (!user || !user.tenantId) throw new Error('User context invalid');
    return this.productsService.update(id, updateProductDto, user.tenantId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    if (!user || !user.tenantId) throw new Error('User context invalid');
    return this.productsService.remove(id, user.tenantId);
  }

  @Post(':id/movements')
  addMovement(@Param('id') id: string, @Body() createMovementDto: CreateMovementDto, @CurrentUser() user: CurrentUserData) {
    if (!user || !user.tenantId) throw new Error('User context invalid');
    return this.productsService.addMovement(id, createMovementDto, user.tenantId);
  }
}
