import LegalLayout, { Secao } from './LegalLayout'
import { EMAIL_CONTATO } from '../../legal'

export default function PrivacidadePage() {
  return (
    <LegalLayout
      titulo="Política de Privacidade"
      resumo="Quais dados o BarberVez trata, para quê, com quem compartilha e como você pede para vê-los ou apagá-los."
    >
      <Secao numero="1" titulo="Quem responde pelos seus dados">
        <p>
          Quando você agenda em uma barbearia, é <strong>aquela barbearia</strong> quem decide
          o que fazer com seus dados — ela é a controladora. O BarberVez trata os dados
          por ordem dela, como operador: armazena, organiza e devolve na tela, sem usar
          para finalidade própria.
        </p>
        <p>
          Na prática: pedidos sobre o conteúdo do seu histórico de atendimento vão à
          barbearia; pedidos sobre a sua conta de acesso vêm a nós. Podemos encaminhar
          entre um e outro quando for o caso.
        </p>
      </Secao>

      <Secao numero="2" titulo="Que dados são tratados">
        <p><strong>Do cliente:</strong> nome, e-mail, telefone, e os agendamentos
        feitos — serviço, data, hora, valor, forma de pagamento e situação.</p>
        <p><strong>Da barbearia:</strong> nome do estabelecimento, e-mail do
        proprietário, logo, contato de WhatsApp, serviços, preços e horário de
        funcionamento.</p>
        <p><strong>Anotações internas:</strong> a barbearia pode registrar observações
        sobre o atendimento. São dela, de uso interno.</p>
        <p>Não tratamos dado de cartão — a plataforma não processa pagamento. Não
        pedimos CPF, endereço nem dado de saúde.</p>
      </Secao>

      <Secao numero="3" titulo="Para que servem">
        <p>
          Para permitir o agendamento e o atendimento (execução de contrato, LGPD
          art. 7º, V), para a barbearia gerir a própria operação e o próprio faturamento
          (legítimo interesse, art. 7º, IX) e para autenticar o acesso à conta.
        </p>
        <p>
          Não vendemos dados, não os cedemos para publicidade e não fazemos perfil
          comportamental.
        </p>
      </Secao>

      <Secao numero="4" titulo="Com quem são compartilhados">
        <p>
          <strong>Com a barbearia em que você agenda</strong> — e somente com ela. Uma barbearia
          não enxerga cliente nem histórico de outra; a separação é aplicada no banco
          de dados, não apenas na tela.
        </p>
        <p>
          <strong>Com nossos prestadores de infraestrutura</strong>, que hospedam a
          aplicação e o banco de dados e cuidam da autenticação, sob obrigação
          contratual de confidencialidade. Os dados ficam armazenados em servidores em
          São Paulo, no Brasil. O envio de e-mails da conta, como o de redefinição de
          senha, pode passar por prestador com servidores fora do país, com as
          salvaguardas do art. 33 da LGPD.
        </p>
        <p>
          <strong>Com autoridade pública</strong>, apenas mediante requisição legal.
        </p>
      </Secao>

      <Secao numero="5" titulo="Por quanto tempo">
        <p>
          O histórico de agendamento fica enquanto a conta da barbearia estiver ativa — é
          dele que sai o faturamento do estabelecimento, que precisa ser preservado.
        </p>
        <p>
          Encerrada a conta da barbearia, os dados são excluídos em até 30 dias, salvo
          obrigação legal de retenção.
        </p>
      </Secao>

      <Secao numero="6" titulo="Seus direitos">
        <p>
          Você pode pedir confirmação de que tratamos seus dados, acesso a eles,
          correção do que estiver errado, portabilidade, e exclusão do que não seja
          necessário manter. Também pode revogar consentimento, quando o tratamento se
          basear nele.
        </p>
        <p>
          O pedido vai para{' '}
          <a href={`mailto:${EMAIL_CONTATO}`} className="underline">{EMAIL_CONTATO}</a>{' '}
          e é respondido em até 15 dias. Pode ser
          preciso confirmar sua identidade antes — justamente para não entregar seus
          dados a outra pessoa.
        </p>
      </Secao>

      <Secao numero="7" titulo="Segurança">
        <p>
          O acesso é por e-mail e senha, com senha armazenada de forma cifrada. O
          isolamento entre barbearias é imposto no próprio banco de dados. O tráfego é
          criptografado em trânsito.
        </p>
        <p>
          Nenhum sistema é imune. Havendo incidente com risco relevante, comunicamos
          os afetados e a ANPD, nos termos do art. 48 da LGPD.
        </p>
      </Secao>

      <Secao numero="8" titulo="Cookies">
        <p>
          Usamos apenas o armazenamento local necessário para manter você conectado
          e lembrar preferências de exibição. Não há cookie de publicidade nem de
          rastreamento de terceiros.
        </p>
      </Secao>

      <Secao numero="9" titulo="Menores de idade">
        <p>
          A conta deve ser criada por pessoa maior de 18 anos. O atendimento de menor
          deve ser agendado por quem responde legalmente por ele.
        </p>
      </Secao>

      <Secao numero="10" titulo="Mudanças nesta política">
        <p>
          Alterações relevantes são avisadas na plataforma antes de valerem. A versão
          vigente fica sempre nesta página, com data de atualização.
        </p>
      </Secao>
    </LegalLayout>
  )
}
