const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isValidCpf,
  isValidCnpj,
  isValidBirthDate,
  validatePersonalRegistration,
  validateOrganizationRegistration
} = require('../src/validation/registrationValidation');

function createValidCnpj(prefix) {
  const firstWeights = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const secondWeights = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const digit = (value, weights) => {
    const sum = [...value].reduce(
      (total, character, index) => total + (character.charCodeAt(0) - 48) * weights[index],
      0
    );
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  const first = digit(prefix, firstWeights);
  const second = digit(`${prefix}${first}`, secondWeights);
  return `${prefix}${first}${second}`;
}

const validPersonalData = {
  nome: 'Maria da Silva',
  cpf: '529.982.247-25',
  data_nascimento: '1990-05-20',
  telefone: '5511999999999',
  logradouro: 'Rua das Flores',
  numero: '123',
  complemento: '',
  bairro: 'Centro',
  municipio: 'São Paulo',
  uf: 'SP',
  cep: '01310930'
};

test('validates CPF checksum and rejects repeated or altered digits', () => {
  assert.equal(isValidCpf('529.982.247-25'), true);
  assert.equal(isValidCpf('529.982.247-24'), false);
  assert.equal(isValidCpf('111.111.111-11'), false);
  assert.equal(isValidCpf('abc52998224725'), false);
});

test('validates numeric and alphanumeric CNPJ checksums', () => {
  const numericCnpj = createValidCnpj('112223330001');
  const alphaNumericCnpj = createValidCnpj('12ABC34501DE');
  assert.equal(numericCnpj, '11222333000181');
  assert.equal(isValidCnpj(numericCnpj), true);
  assert.equal(isValidCnpj(alphaNumericCnpj), true);
  assert.equal(isValidCnpj(`${alphaNumericCnpj.slice(0, 13)}0`), false);
});

test('requires a valid personal profile including Brazilian phone and CEP formats', () => {
  assert.equal(validatePersonalRegistration(validPersonalData), null);
  assert.match(validatePersonalRegistration({ ...validPersonalData, cpf: '12345678900' }), /CPF/);
  assert.match(validatePersonalRegistration({ ...validPersonalData, telefone: '551199999999' }), /celular/);
  assert.match(validatePersonalRegistration({ ...validPersonalData, cep: '00000000' }), /CEP/);
  assert.equal(isValidBirthDate('2099-01-01'), false);
  assert.equal(isValidBirthDate('1990-02-30'), false);
});

test('requires CNPJ and corporate names only for business accounts', () => {
  assert.equal(validateOrganizationRegistration({ tipo_cadastro: 'pf' }), null);
  const business = {
    tipo_cadastro: 'pj',
    cnpj: '11222333000181',
    razao_social: 'Empresa Exemplo Ltda.',
    nome_fantasia: 'Empresa Exemplo'
  };
  assert.equal(validateOrganizationRegistration(business), null);
  assert.match(validateOrganizationRegistration({ ...business, cnpj: '12345678000190' }), /CNPJ/);
  assert.match(validateOrganizationRegistration({ ...business, nome_fantasia: '' }), /fantasia/);
});
