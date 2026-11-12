const brazilianStates = new Set([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO'
]);

function digitsOnly(value) {
  return typeof value === 'string' && /^[\d.\-\s]+$/.test(value)
    ? value.replace(/\D/g, '')
    : '';
}

function isValidCpf(value) {
  const cpf = digitsOnly(value);
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;

  const calculateDigit = (slice, factor) => {
    let sum = 0;
    for (const digit of slice) sum += Number(digit) * factor--;
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return calculateDigit(cpf.slice(0, 9), 10) === Number(cpf[9]) &&
    calculateDigit(cpf.slice(0, 10), 11) === Number(cpf[10]);
}

function isValidCnpj(value) {
  const cnpj = typeof value === 'string' && /^[a-z0-9./\-\s]+$/i.test(value)
    ? value.replace(/[^a-z0-9]/gi, '').toUpperCase()
    : '';
  if (!/^[A-Z0-9]{12}\d{2}$/.test(cnpj) || /^([A-Z0-9])\1{13}$/.test(cnpj)) return false;

  const calculateDigit = (slice, weights) => {
    const sum = [...slice].reduce(
      (total, character, index) => total + (character.charCodeAt(0) - 48) * weights[index],
      0
    );
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const firstDigit = calculateDigit(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const secondDigit = calculateDigit(cnpj.slice(0, 12) + firstDigit, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return firstDigit === Number(cnpj[12]) && secondDigit === Number(cnpj[13]);
}

function isValidBirthDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value &&
    value < new Date().toISOString().slice(0, 10);
}

function validatePersonalRegistration(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return 'Informe os dados pessoais obrigatórios.';
  }
  if (!data.nome || typeof data.nome !== 'string' || data.nome.trim().length > 120) {
    return 'Informe o nome completo.';
  }
  if (!isValidCpf(data.cpf)) return 'Informe um CPF válido.';
  if (!isValidBirthDate(data.data_nascimento)) return 'Informe uma data de nascimento válida, anterior à data atual.';
  if (!/^55[1-9][1-9]\d{9}$/.test(data.telefone || '')) {
    return 'Informe um celular brasileiro com código 55, DDD e 9 dígitos.';
  }
  if (!data.logradouro || typeof data.logradouro !== 'string' || data.logradouro.trim().length > 160) {
    return 'Informe o logradouro.';
  }
  if (!data.numero || typeof data.numero !== 'string' || data.numero.trim().length > 20) {
    return 'Informe o número do endereço.';
  }
  if (typeof data.complemento !== 'string' || data.complemento.trim().length > 100) {
    return 'O complemento deve ter no máximo 100 caracteres.';
  }
  if (!data.bairro || typeof data.bairro !== 'string' || data.bairro.trim().length > 100) {
    return 'Informe o bairro.';
  }
  if (!data.municipio || typeof data.municipio !== 'string' || data.municipio.trim().length > 100) {
    return 'Informe o município.';
  }
  if (!brazilianStates.has(data.uf)) return 'Selecione uma UF válida.';
  if (!/^(?!([0-9])\1{7}$)(?!0{8}$)\d{8}$/.test(data.cep || '')) {
    return 'Informe um CEP válido com 8 dígitos.';
  }
  return null;
}

function validateOrganizationRegistration(data) {
  if (!['pf', 'pj'].includes(data.tipo_cadastro)) {
    return 'Selecione pessoa física ou pessoa jurídica.';
  }
  if (data.tipo_cadastro === 'pf') return null;
  if (!isValidCnpj(data.cnpj)) return 'Informe um CNPJ válido.';
  if (typeof data.razao_social !== 'string' || !data.razao_social.trim() || data.razao_social.trim().length > 255) {
    return 'Informe a razão social.';
  }
  if (typeof data.nome_fantasia !== 'string' || !data.nome_fantasia.trim() || data.nome_fantasia.trim().length > 255) {
    return 'Informe o nome fantasia.';
  }
  return null;
}

module.exports = {
  digitsOnly,
  isValidCpf,
  isValidCnpj,
  isValidBirthDate,
  validatePersonalRegistration,
  validateOrganizationRegistration
};
