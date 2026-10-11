import LegalLayout, { Secao } from './LegalLayout'
import { EMAIL_CONTATO } from '../../legal'

export default function PrivacidadePage() {
  return (
    <LegalLayout
      titulo="Política de Privacidade"
      resumo="Quais dados a Alves BarberShop trata, para quê, com quem compartilha e como você pede para vê-los ou apagá-los."
    >
      <Secao numero="1" titulo="Quem responde pelos seus dados">
        <p>
          A <strong>Alves BarberShop</strong> é a responsável pelos dados tratados neste
          sistema de agendamento — é ela quem decide como são usados, sempre para
          organizar os atendimentos.
        </p>
        <p>
          Qualquer pedido sobre seus dados ou sobre sua conta vai para{' '}
          <a href={`mailto:${EMAIL_CONTATO}`} className="underline">{EMAIL_CONTATO}</a>.
        </p>
      </Secao>

      <Secao numero="2" titulo="Que dados são tratados">
        <p><strong>Do cliente:</strong> nome, e-mail, telefone, e os agendamentos
        feitos — serviço, data, hora, valor, forma de pagamento e situação.</p>
        <p><strong>Anotações internas:</strong> a barbearia pode registrar observações
        sobre o atendimento e valores em aberto. São de uso interno.</p>
        <p>Não tratamos dado de cartão — o sistema não processa pagamento. Não
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
          <strong>Com nossos prestadores de infraestrutura</strong>, que hospedam o
          sistema e o banco de dados e cuidam da autenticação, sob obrigação
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
          O histórico de agendamento fica guardado enquanto você tiver conta — é dele
          que sai o faturamento da barbearia, que precisa ser preservado.
        </p>
        <p>
          Se você pedir a exclusão da conta, os dados são excluídos em até 30 dias,
          salvo obrigação legal de retenção.
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
          O acesso é por e-mail e senha, com senha armazenada de forma cifrada. Cada
          cliente enxerga apenas os próprios agendamentos, e essa trava é imposta no
          próprio banco de dados. O tráfego é criptografado em trânsito.
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
          Alterações relevantes são avisadas no sistema antes de valerem. A versão
          vigente fica sempre nesta página, com data de atualização.
        </p>
      </Secao>
    </LegalLayout>
  )
}
