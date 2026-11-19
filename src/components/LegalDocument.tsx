import { useEffect } from "react";
import { Platform, Text, View } from "react-native";
import { InlineLink } from "./InlineLink";
import { Screen, TabBar } from "./ui";
import { colors, font } from "./theme";
import { linkParts, type LegalDoc } from "../lib/legal";

function Paragraph({ text }: { text: string }) {
  const parts = linkParts(text);
  return (
    <Text style={{ fontFamily: font.body, color: colors.ink, fontSize: 16, lineHeight: 24 }}>
      {parts.map((part, index) =>
        part.href ? (
          <InlineLink key={`${part.href}-${index}`} href={part.href}>
            {part.text}
          </InlineLink>
        ) : (
          <Text key={index}>{part.text}</Text>
        ),
      )}
    </Text>
  );
}

export function LegalDocument({ doc }: { doc: LegalDoc }) {
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const previous = document.title;
    document.title = doc.titleTag;
    return () => {
      document.title = previous;
    };
  }, [doc.titleTag]);

  return (
    <Screen footer={<TabBar />}>
      <View style={{ padding: 20, gap: 14 }}>
        <Text accessibilityRole="header" style={{ fontFamily: font.display, fontSize: 34, lineHeight: 38, color: colors.ink, textAlign: "center" }}>
          {doc.title}
        </Text>
        <Text style={{ fontFamily: font.medium, color: colors.muted, textAlign: "center" }}>Actualizado el {doc.updated}</Text>
        {doc.intro.map((text) => (
          <Paragraph key={text} text={text} />
        ))}
        {doc.sections.map((section) => (
          <View key={section.heading} nativeID={section.id} style={{ gap: 8 }}>
            <Text accessibilityRole="header" style={{ fontFamily: font.displaySoft, fontSize: 22, color: colors.ink, marginTop: 8 }}>
              {section.heading}
            </Text>
            {section.paragraphs.map((text) => (
              <Paragraph key={text} text={text} />
            ))}
          </View>
        ))}
        {doc.englishTitle ? (
          <View style={{ gap: 8, marginTop: 12 }}>
            <Text accessibilityRole="header" style={{ fontFamily: font.displaySoft, fontSize: 22, color: colors.ink }}>
              {doc.englishTitle}
            </Text>
            {(doc.englishParagraphs ?? []).map((text) => (
              <Paragraph key={text} text={text} />
            ))}
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
