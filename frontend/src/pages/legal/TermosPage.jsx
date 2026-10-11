import { Link } from 'react-router-dom'
import LegalLayout, { Secao } from './LegalLayout'
import { EMAIL_CONTATO } from '../../legal'

export default function TermosPage() {
  return (
    <LegalLayout
      titulo="Termos de Uso"
      resumo="Estas são as regras de uso do sistema de agendamento da Alves BarberShop. Elas valem para quem cria conta e marca horário por ele."
    >
      <Secao numero="1" titulo="Quem é quem">
        <p>
          A <strong>Alves BarberShop</strong> é a barbearia responsável por este sistema de
          agendamento e pelos atendimentos marcados por ele. Contato:{' '}
          <a href={`mailto:${EMAIL_CONTATO}`} className="underline">{EMAIL_CONTATO}</a>.
        </p>
        <p>
          O <strong>cliente</strong> é quem cria conta para marcar horário na Alves BarberShop.
        </p>
      </Secao>

      <Secao numero="2" titulo="O que o sistema faz">
        <p>
          Permite ao cliente ver os horários livres, marcar, acompanhar e cancelar os
          próprios agendamentos pela internet.
        </p>
        <p>
          Para a barbearia, organiza a agenda, a carteira de clientes, os serviços e o
          caixa do dia a dia.
        </p>
      </Secao>

      <Secao numero="3" titulo="O que o sistema não faz">
        <p>
          Não processa pagamento: o serviço é pago diretamente na barbearia. Atraso,
          cancelamento, remarcação e qualquer combinado sobre o atendimento são tratados
          diretamente com a Alves BarberShop.
        </p>
      </Secao>

      <Secao numero="4" titulo="Conta de acesso">
        <p>
          Cada pessoa é responsável pelo sigilo da própria senha e pelo que for feito
          com sua conta. Informações de cadastro devem ser verdadeiras e mantidas
          atualizadas.
        </p>
      </Secao>

      <Secao numero="5" titulo="Seus dados">
        <p>
          Seus dados de cadastro e o histórico dos seus atendimentos são usados somente
          pela Alves BarberShop para organizar os atendimentos. Não são vendidos nem
          cedidos para publicidade.
        </p>
        <p>
          O detalhamento está na <Link to="/privacidade" className="underline">Política de Privacidade</Link>.
        </p>
      </Secao>

      <Secao numero="6" titulo="Disponibilidade">
        <p>
          O sistema depende de serviços de terceiros (hospedagem, banco de dados,
          autenticação) e pode ficar fora do ar por manutenção, falha técnica ou causa
          externa. Nesses casos, o horário pode ser combinado diretamente com a barbearia.
        </p>
      </Secao>

      <Secao numero="7" titulo="Uso indevido">
        <p>
          É vedado tentar acessar dados de outros clientes, contornar as travas de
          permissão, automatizar cadastro em massa, sobrecarregar o sistema
          deliberadamente ou usá-lo para atividade ilícita. A conta envolvida pode ser
          suspensa de imediato.
        </p>
      </Secao>

      <Secao numero="8" titulo="Encerramento da conta">
        <p>
          Você pode pedir a exclusão da sua conta a qualquer momento pelo e-mail de
          contato. Os dados são excluídos, ressalvado o que a lei obrigue a guardar.
        </p>
        <p>
          A barbearia pode suspender a conta de quem descumprir estes termos.
        </p>
      </Secao>

      <Secao numero="9" titulo="Alterações destes termos">
        <p>
          Estes termos podem mudar. Alterações relevantes são avisadas no sistema
          antes de passarem a valer, e a versão vigente fica sempre nesta página, com
          data de atualização.
        </p>
      </Secao>

      <Secao numero="10" titulo="Lei aplicável">
        <p>
          Aplica-se a lei brasileira. Para as questões que não puderem ser resolvidas
          de outro modo, valem as regras de competência previstas em lei, inclusive o
          direito do consumidor de demandar no foro do seu domicílio.
        </p>
      </Secao>
    </LegalLayout>
  )
}
