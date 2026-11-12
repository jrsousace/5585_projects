function registrationDigits(value) {
  return value.replace(/\D/g, '');
}

function isValidBrazilianCpf(value) {
  const cpf = registrationDigits(value);
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (digits, factor) => {
    const sum = [...digits].reduce((total, current) => total + Number(current) * factor--, 0);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return digit(cpf.slice(0, 9), 10) === Number(cpf[9]) &&
    digit(cpf.slice(0, 10), 11) === Number(cpf[10]);
}

function isValidBrazilianCnpj(value) {
  const cnpj = value.replace(/[^a-z0-9]/gi, '').toUpperCase();
  if (!/^[A-Z0-9]{12}\d{2}$/.test(cnpj) || /^([A-Z0-9])\1{13}$/.test(cnpj)) return false;
  const digit = (valueToCheck, weights) => {
    const sum = [...valueToCheck].reduce(
      (total, character, index) => total + (character.charCodeAt(0) - 48) * weights[index],
      0
    );
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  const first = digit(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = digit(cnpj.slice(0, 12) + first, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return first === Number(cnpj[12]) && second === Number(cnpj[13]);
}

function validatePersonalFields(form, prefix) {
  const field = (name) => form.querySelector(`#${prefix ? `${prefix}-${name}` : `reg-${name}`}`);
  const cpf = field('cpf');
  const phone = field('phone');
  const cep = field('cep');
  const birthDate = field('birth-date');
  cpf.setCustomValidity(isValidBrazilianCpf(cpf.value) ? '' : 'Informe um CPF válido.');
  phone.setCustomValidity(/^[1-9][1-9]\d{9}$/.test(registrationDigits(phone.value))
    ? ''
    : 'Informe DDD e um número brasileiro de celular com 11 dígitos.');
  cep.setCustomValidity(/^(?!([0-9])\1{7}$)(?!0{8}$)\d{8}$/.test(registrationDigits(cep.value))
    ? ''
    : 'Informe um CEP com 8 dígitos.');
  birthDate.setCustomValidity(birthDate.value && birthDate.value < new Date().toISOString().slice(0, 10)
    ? ''
    : 'Informe uma data de nascimento anterior à data atual.');
}

document.addEventListener('DOMContentLoaded', () => {
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    const typeInputs = registerForm.querySelectorAll('input[name="tipo_cadastro"]');
    const businessFields = document.getElementById('business-fields');
    const cnpj = document.getElementById('reg-cnpj');
    const legalName = document.getElementById('reg-legal-name');
    const tradeName = document.getElementById('reg-trade-name');
    const birthDate = document.getElementById('reg-birth-date');
    birthDate.max = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    const updateBusinessFields = () => {
      const isBusiness = registerForm.querySelector('input[name="tipo_cadastro"]:checked').value === 'pj';
      businessFields.hidden = !isBusiness;
      for (const input of [cnpj, legalName, tradeName]) {
        input.required = isBusiness;
        input.disabled = !isBusiness;
        input.setCustomValidity('');
      }
    };
    typeInputs.forEach((input) => input.addEventListener('change', updateBusinessFields));
    updateBusinessFields();

    document.getElementById('reg-cpf').addEventListener('input', (event) => {
      const digits = registrationDigits(event.target.value).slice(0, 11);
      event.target.value = digits
        .replace(/^(\d{3})(\d)/, '$1.$2')
        .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
      event.target.setCustomValidity('');
    });
    cnpj.addEventListener('input', (event) => {
      event.target.value = event.target.value.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 14);
      event.target.setCustomValidity('');
    });
    document.getElementById('reg-cep').addEventListener('input', (event) => {
      const digits = registrationDigits(event.target.value).slice(0, 8);
      event.target.value = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
      event.target.setCustomValidity('');
    });
    for (const id of ['reg-phone', 'reg-birth-date']) {
      document.getElementById(id).addEventListener('input', (event) => event.target.setCustomValidity(''));
      document.getElementById(id).addEventListener('change', (event) => event.target.setCustomValidity(''));
    }

    registerForm.addEventListener('submit', (event) => {
      validatePersonalFields(registerForm);
      cnpj.setCustomValidity(
        !cnpj.disabled && !isValidBrazilianCnpj(cnpj.value) ? 'Informe um CNPJ válido.' : ''
      );
      if (!registerForm.checkValidity()) {
        event.preventDefault();
        registerForm.reportValidity();
      }
    }, true);
  }

  const invitationForm = document.getElementById('invitation-form');
  if (invitationForm) {
    for (const [id, validator] of [
      ['invite-cpf', isValidBrazilianCpf],
      ['invite-cep', (value) => /^(?!([0-9])\1{7}$)(?!0{8}$)\d{8}$/.test(registrationDigits(value))],
      ['invite-phone', (value) => /^[1-9][1-9]\d{9}$/.test(registrationDigits(value))]
    ]) {
      const input = document.getElementById(id);
      input.addEventListener('input', () => {
        input.setCustomValidity('');
        if (id === 'invite-cep') {
          const digits = registrationDigits(input.value).slice(0, 8);
          input.value = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
        } else if (id === 'invite-cpf') {
          const digits = registrationDigits(input.value).slice(0, 11);
          input.value = digits
            .replace(/^(\d{3})(\d)/, '$1.$2')
            .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
            .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
        } else {
          input.value = registrationDigits(input.value).slice(0, 11);
        }
      });
      input.addEventListener('change', () => {
        input.setCustomValidity(validator(input.value) ? '' : 'Confira o valor informado.');
      });
    }

    for (const id of ['invite-birth-date']) {
      const input = document.getElementById(id);
      input.max = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      input.addEventListener('change', (event) => {
        const currentInput = event.target;
        currentInput.setCustomValidity(currentInput.value && currentInput.value < new Date().toISOString().slice(0, 10)
          ? ''
          : 'Informe uma data de nascimento anterior à data atual.');
      });
    }
    invitationForm.addEventListener('submit', () => {
      validatePersonalFields(invitationForm, 'invite');
    }, true);
  }
});
