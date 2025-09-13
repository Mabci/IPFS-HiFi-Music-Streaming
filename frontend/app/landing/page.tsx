"use client"

import { Play, Headphones, Zap, Shield, Globe, Check } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 lg:py-32">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-primary/5" />
        <div className="container mx-auto px-4 relative">
          <div className="text-center space-y-8 max-w-4xl mx-auto">
            <div className="space-y-4">
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Música Descentralizada
              </h1>
              <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                Experimenta el futuro del streaming musical con tecnología IPFS. 
                Reproducción P2P, calidad lossless y total descentralización.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button className="bg-primary text-primary-foreground hover:bg-primary/90 px-8 py-4 rounded-xl text-lg font-semibold flex items-center gap-3 transition-all hover:scale-105">
                <Play size={24} />
                Comenzar a Escuchar
              </button>
              <button className="border border-border hover:bg-muted px-8 py-4 rounded-xl text-lg font-semibold transition-colors">
                Explorar Catálogo
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">¿Por qué elegir IPFS Music?</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              La próxima generación de streaming musical está aquí
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Zap size={32} />}
              title="Ultra Rápido"
              description="Streaming P2P con fallback HTTP para máxima velocidad y disponibilidad"
              gradient="from-blue-500 to-cyan-500"
            />
            <FeatureCard
              icon={<Headphones size={32} />}
              title="Calidad Premium"
              description="Soporte nativo para FLAC, AAC y formatos lossless de alta fidelidad"
              gradient="from-purple-500 to-pink-500"
            />
            <FeatureCard
              icon={<Shield size={32} />}
              title="Descentralizado"
              description="Sin servidores centrales. Tu música distribuida en la red IPFS global"
              gradient="from-green-500 to-emerald-500"
            />
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="bg-card border rounded-2xl p-8 md:p-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
              <div className="space-y-2">
                <div className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">∞</div>
                <div className="text-muted-foreground">Capacidad de Red</div>
              </div>
              <div className="space-y-2">
                <div className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">24/7</div>
                <div className="text-muted-foreground">Disponibilidad</div>
              </div>
              <div className="space-y-2">
                <div className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">0ms</div>
                <div className="text-muted-foreground">Latencia P2P</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Premium Plans */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Planes Premium</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Desbloquea todo el potencial de la música descentralizada
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Plan Básico */}
            <PricingCard
              title="Básico"
              price="Gratis"
              description="Perfecto para comenzar"
              features={[
                "Streaming básico",
                "Calidad estándar",
                "Acceso limitado",
                "Anuncios incluidos"
              ]}
              buttonText="Comenzar Gratis"
              popular={false}
            />

            {/* Plan Pro */}
            <PricingCard
              title="Pro"
              price="$9.99/mes"
              description="Para audiófilos exigentes"
              features={[
                "Streaming ilimitado",
                "Calidad lossless FLAC",
                "Sin anuncios",
                "Descargas offline",
                "P2P prioritario"
              ]}
              buttonText="Obtener Pro"
              popular={true}
            />

            {/* Plan Premium */}
            <PricingCard
              title="Premium"
              price="$19.99/mes"
              description="La experiencia completa"
              features={[
                "Todo de Pro +",
                "Calidad Hi-Res 24-bit",
                "Acceso anticipado",
                "Soporte prioritario",
                "Funciones exclusivas"
              ]}
              buttonText="Obtener Premium"
              popular={false}
            />
          </div>
        </div>
      </section>

      {/* Tech Info */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="bg-card border rounded-2xl p-8 md:p-12 space-y-6">
            <div className="flex items-center gap-3 justify-center">
              <Globe size={32} className="text-primary" />
              <h3 className="text-2xl font-semibold">Tecnología IPFS</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-center">
              <div className="space-y-3">
                <div className="font-medium text-muted-foreground">Red Descentralizada</div>
                <p className="text-sm text-muted-foreground">
                  Tu música se distribuye a través de miles de nodos en todo el mundo, 
                  garantizando disponibilidad y velocidad óptimas.
                </p>
              </div>
              <div className="space-y-3">
                <div className="font-medium text-muted-foreground">Resistente a Censura</div>
                <p className="text-sm text-muted-foreground">
                  Sin puntos únicos de falla. La música permanece accesible 
                  independientemente de restricciones geográficas o técnicas.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-3xl mx-auto space-y-8">
            <h2 className="text-3xl md:text-4xl font-bold">
              Únete a la Revolución Musical
            </h2>
            <p className="text-xl opacity-90">
              Sé parte del futuro de la música. Descentralizada, libre y para todos.
            </p>
            <button className="bg-background text-foreground hover:bg-background/90 px-8 py-4 rounded-xl text-lg font-semibold transition-all hover:scale-105">
              Comenzar Ahora
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

function FeatureCard({ 
  icon, 
  title, 
  description, 
  gradient 
}: { 
  icon: React.ReactNode
  title: string
  description: string
  gradient: string
}) {
  return (
    <div className="bg-card border rounded-2xl p-8 hover:shadow-lg transition-all hover:-translate-y-1">
      <div className={`w-16 h-16 bg-gradient-to-br ${gradient} rounded-2xl flex items-center justify-center mb-6 mx-auto`}>
        <div className="text-white">{icon}</div>
      </div>
      <h3 className="text-xl font-semibold mb-3 text-center">{title}</h3>
      <p className="text-muted-foreground text-center leading-relaxed">{description}</p>
    </div>
  )
}

function PricingCard({
  title,
  price,
  description,
  features,
  buttonText,
  popular
}: {
  title: string
  price: string
  description: string
  features: string[]
  buttonText: string
  popular: boolean
}) {
  return (
    <div className={`bg-card border rounded-2xl p-8 relative ${
      popular ? 'border-primary shadow-lg scale-105' : ''
    }`}>
      {popular && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
          <span className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
            Más Popular
          </span>
        </div>
      )}
      
      <div className="text-center space-y-4">
        <h3 className="text-2xl font-bold">{title}</h3>
        <div className="text-3xl font-bold text-primary">{price}</div>
        <p className="text-muted-foreground">{description}</p>
      </div>

      <div className="space-y-3 my-8">
        {features.map((feature, index) => (
          <div key={index} className="flex items-center gap-3">
            <Check size={16} className="text-green-500 flex-shrink-0" />
            <span className="text-sm">{feature}</span>
          </div>
        ))}
      </div>

      <button className={`w-full py-3 rounded-xl font-semibold transition-colors ${
        popular 
          ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
          : 'border border-border hover:bg-muted'
      }`}>
        {buttonText}
      </button>
    </div>
  )
}
