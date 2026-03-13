import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import DigText from "@/components/DigText";

const sampleArticle = `In the context of the recent legal changes in Taiwan, >>On May 24th Taiwan's highest court ruled in favour of guy rights and marriage equality. >>The court ruled on that marriage should not be limited to a man and a woman and ordered parliament either to change the law or award marriage rights to gay couples within two years.<< China reacted with surprising indifference and only one newspaper took notice. >>English-language newspaper took notice of a decision that would be the first to legalise gay marriage in an Asian country (not counting New Zealand). The more widely read Chinese version ignored it, as did television and other news outlets.<<<< China proved once more that it's reluctant to embrace gay rights. >>Homosexuality was removed from the health ministry's list of mental disorders only in 2001. Additionally China recently banned the depiction of homosexuals on television (not that there were many in the first place.)<< This is perplexing because Chinese spiritual >>Taoism regarded sex as neither good nor bad, while Confucianism, by encouraging close relations between master and pupils, is sometimes thought to have indirectly encouraged it.<< and artistic tradition >>In poetry of the 9th century, usually held to be the golden age of Chinese literature, it is sometimes hard to tell whether a love poem is addressed to a woman or a man. Also China's greatest novel, "The Dream of the Red Chamber", written in the late 18th century, includes both heterosexual and same-sex relations. Among literate elites, China does not seem to have shared the strong bias evident elsewhere.<< has long been relaxed about homosexuality. Two factors contribute to this lingering disdain. 1) Traditional family values remain strong. Sons are expected to represent family's good name, and are supposed to marry and have sons. >>In 2016 Peking University's sociology department carried out the largest survey of attitudes to, and among, homosexuals and other sexual minorities on behalf of the UN Development Programme. It found that 58% of respondents (gay and straight) agreed with the statement that gays are rejected by their families a higher level of rejection than occurs at work or school. Fewer than 15% of homosexuals said they had come out to their families, and more than half of those who did said they had experienced discrimination as a result.<< 2) China's not a democracy and forbids protest and activism, that helped establish gay rights in most countries. >>In most countries, gays have had to establish their rights by holding meetings and marches, arguing their case in the media. China's Communist Party does not like the public expression of rights of any kind and has squelched most discussion of gay concerns.<< However, Chinese attitudes are also changing. Young people are much more tolerant, which may in some time bring official perspective to the change. >>The Peking University survey revealed a big generation gap: 35% of those born before 1970 said they would reject a child who was gay; only 9% born after 1990 agreed. >>Though official media suppressed discussion of the pro gay-rights ruling in Taiwan, Weibo, China's Twitter, lit up with millions of reactions, most of them positive. Li Yinhe, a sociologist at the Chinese Academy of Social Sciences, pointed out that the average age of members of China's National People's Congress (the rubber-stamp parliament that would have to change marriage laws) is 49, at a time when the majority of people under the age of 35 approve of gay marriage. "Due to the influence of Taiwan, we're 14 years away from legalising it," she concluded.<<<<<`;

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-2xl mx-auto px-6 py-5 flex items-center justify-between">
          <h1 className="font-sans text-sm font-semibold tracking-[0.2em] uppercase text-foreground">
            Dig.txt
          </h1>
          <p className="font-sans text-xs text-muted-foreground tracking-wide">
            Progressive reading
          </p>
        </div>
      </header>

      {/* Article */}
      <main className="max-w-2xl mx-auto px-6 py-12">
        {/* Article meta */}
        <div className="mb-8">
          <p className="font-sans text-xs text-muted-foreground tracking-wider uppercase mb-3">
            The Economist explains · Jun 6th 2017
          </p>
          <h2 className="text-3xl md:text-4xl font-serif font-600 leading-tight mb-4 text-foreground">
            China's reluctance to gay rights
          </h2>
          <p className="text-lg font-serif italic text-muted-foreground leading-relaxed">
            Despite a historically relaxed view of homosexuality, China seems reluctant to embrace gay rights
          </p>
        </div>

        <div className="w-12 h-px bg-border mb-8" />

        {/* Dig Text content */}
        <DigText content={sampleArticle} />

        {/* About section */}
        <div className="mt-16 pt-8 border-t border-border">
          <h3 className="font-sans text-xs font-semibold tracking-[0.15em] uppercase text-muted-foreground mb-4">
            What is Dig.txt?
          </h3>
          <p className="text-base leading-relaxed text-muted-foreground font-serif">
            Dig.txt presents text in its most collapsed form by default. Click the{" "}
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-expand-button text-expand-button align-middle mx-0.5">
              <span className="text-xs">+</span>
            </span>{" "}
            buttons to expand sections you find valuable or interesting. 
            This reverses the traditional approach of showing everything at once, 
            letting you dig into the depth you choose.
          </p>
        </div>
      </main>
    </div>
  );
};

export default Index;
