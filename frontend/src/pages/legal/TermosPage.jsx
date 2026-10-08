import { Link } from 'react-router-dom'
import LegalLayout, { Secao } from './LegalLayout'
import { EMAIL_CONTATO } from '../../legal'

export default function TermosPage() {
  return (
    <LegalLayout
      titulo="Termos de Uso"
      resumo="Estas são as regras de uso do BarberVez. Elas valem para a barbearia que contrata a plataforma e para o cliente que agenda por ela."
    >
      <Secao numero="1" titulo="Quem é quem">
        <p>
          O <strong>BarberVez</strong> é a plataforma de gestão, operada por{' '}
          Ricardo Parise Macarios Junior, contato{' '}
          <a href={`mailto:${EMAIL_CONTATO}`} className="underline">{EMAIL_CONTATO}</a>.
        </p>
        <p>
          A <strong>barbearia</strong> é o estabelecimento que contrata a plataforma para
          gerir sua agenda, seus serviços e sua carteira de clientes.
        </p>
        <p>
          O <strong>cliente</strong> é quem cria conta para agendar serviços em uma barbearia.
          A relação de atendimento é entre ele e a barbearia; a plataforma fornece apenas
          o meio pelo qual o horário é marcado.
        </p>
      </Secao>

      <Secao numero="2" titulo="O que a plataforma faz">
        <p>
          Disponibiliza um sistema web para agendamento, cadastro de clientes,
          controle de serviços e acompanhamento financeiro da própria barbearia, além de
          uma página pública por meio da qual os clientes da barbearia podem marcar horário.
        </p>
        <p>
          Módulos adicionais podem ser habilitados ou não conforme o plano contratado.
        </p>
      </Secao>

      <Secao numero="3" titulo="O que a plataforma não faz">
        <p>
          Não presta serviços de barbearia, não define preços, não garante o atendimento
          e não intermedeia pagamento entre cliente e barbearia. Cancelamento, remarcação,
          atraso, qualidade do serviço e cobrança são responsabilidade da barbearia.
        </p>
      </Secao>

      <Secao numero="4" titulo="Conta de acesso">
        <p>
          Cada pessoa é responsável pelo sigilo da própria senha e pelo que for feito
          com sua conta. Informações de cadastro devem ser verdadeiras e mantidas
          atualizadas.
        </p>
        <p>
          A conta do cliente é única e pode ser usada em mais de uma barbearia. Cada barbearia
          enxerga apenas o histórico de atendimentos feitos nela.
        </p>
      </Secao>

      <Secao numero="5" titulo="Dados da barbearia e dos clientes">
        <p>
          Os dados cadastrais e o histórico de atendimento dos clientes de uma barbearia
          pertencem àquela barbearia. A plataforma os armazena e processa por conta dela,
          e não os utiliza para finalidade própria nem os compartilha com outras barbearias.
        </p>
        <p>
          O detalhamento está na <Link to="/privacidade" className="underline">Política de Privacidade</Link>.
        </p>
      </Secao>

      <Secao numero="6" titulo="Disponibilidade e responsabilidade">
        <p>
          A plataforma é fornecida no estado em que se encontra e depende de serviços
          de terceiros (hospedagem, banco de dados, autenticação). Pode haver
          indisponibilidade por manutenção, falha técnica ou causa externa.
        </p>
        <p>
          Não nos responsabilizamos por lucro cessante, perda de agendamento ou dano
          indireto decorrentes de indisponibilidade. Nossa responsabilidade, quando
          houver, limita-se ao valor pago pela barbearia nos 12 meses anteriores ao evento.
        </p>
        <p>
          É recomendável que a barbearia mantenha registro próprio dos compromissos
          essenciais.
        </p>
      </Secao>

      <Secao numero="7" titulo="Uso indevido">
        <p>
          É vedado tentar acessar dados de outra barbearia, contornar as travas de
          permissão, automatizar cadastro em massa, sobrecarregar a plataforma
          deliberadamente ou usá-la para atividade ilícita. A conta envolvida pode ser
          suspensa de imediato.
        </p>
      </Secao>

      <Secao numero="8" titulo="Encerramento">
        <p>
          A barbearia pode encerrar o uso quando quiser. Podemos encerrar a prestação por
          descumprimento destes termos ou por inadimplência, com aviso prévio quando
          a situação permitir.
        </p>
        <p>
          Encerrada a conta, a barbearia pode solicitar a exportação dos seus dados em até
          30 dias. Depois desse prazo, os dados são excluídos, ressalvado o que a lei
          obrigue a guardar.
        </p>
      </Secao>

      <Secao numero="9" titulo="Alterações destes termos">
        <p>
          Estes termos podem mudar. Alterações relevantes são avisadas na plataforma
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
